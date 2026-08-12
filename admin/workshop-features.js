/* Operational extensions kept separate from the original dashboard shell. */
const originalHydrateCache = hydrateCache;
hydrateCache = async () => {
  await originalHydrateCache();
  cache.parts = await getRows('parts', 'id,name,sku,quantity,cost_price,sale_price,active', { order: 'name', asc: true });
};

const statusLabel = (status) => String(status || '').replaceAll('_', ' ');
const selectOptions = (rows, selected, label) => rows.map(row => `<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${esc(label(row))}</option>`).join('');
const itemTypes = '<option value="servico">Mão de obra</option><option value="peca">Peça</option>';

function actionTable(rows, budget = false) {
  if (!rows.length) return empty();
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${budget ? 'Orçamento' : 'OS'}</th><th>Cliente / veículo</th><th>Emissão</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows.map(o => `<tr><td><strong>#${o.number}</strong></td><td>${esc(o.customers?.full_name || o.quote_customer_name || 'Cliente avulso')}<br><small>${esc(o.vehicles?.plate || '—')} · ${esc(o.vehicles?.brand || '')} ${esc(o.vehicles?.model || o.quote_vehicle_description || 'Veículo não informado')}</small></td><td>${fmtDate(o.opened_at)}</td><td><strong>${money.format(o.total || 0)}</strong></td><td><span class="status ${esc(o.status)}">${esc(statusLabel(o.status))}</span></td><td><div class="table-actions">${budget ? `<button class="primary-small" data-approve-budget="${o.id}" data-budget-number="${o.number}">Aprovar e gerar OS</button>` : ''}<button class="secondary-action" data-edit-order="${o.id}">Editar</button>${budget ? `<button class="secondary-action" data-budget-pdf="${o.number}">PDF</button><button class="danger-action" data-delete-budget="${o.id}" data-budget-number="${o.number}">Apagar</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
}

budgetTable = rows => actionTable(rows, true);
renderBudgets = async () => {
  const all = await getRows('service_orders', 'id,number,status,total,opened_at,quote_customer_name,quote_vehicle_description,customers(full_name),vehicles(plate,brand,model)', { order: 'opened_at' });
  const rows = all.filter(row => row.status === 'orcamento');
  content.innerHTML = `<div class="row-actions"><input id="budget-filter" class="search" placeholder="Buscar cliente, placa ou orçamento"><span class="muted">${rows.length} orçamento${rows.length === 1 ? '' : 's'} pendente${rows.length === 1 ? '' : 's'}</span></div><section class="panel"><h2>Orçamentos</h2><p class="muted">Aprove para transformar o mesmo registro em uma ordem de serviço.</p><div id="budgets-table">${actionTable(rows, true)}</div></section>`;
  $('#budget-filter').oninput = event => {
    const term = event.target.value.toLowerCase();
    $('#budgets-table').innerHTML = actionTable(rows.filter(o => [o.number, o.customers?.full_name, o.quote_customer_name, o.vehicles?.plate, o.quote_vehicle_description].join(' ').toLowerCase().includes(term)), true);
  };
};

renderOrders = async () => {
  const all = await getRows('service_orders', 'id,number,status,total,opened_at,expected_at,customers(full_name),vehicles(plate,brand,model)', { order: 'opened_at' });
  const rows = all.filter(row => row.status !== 'orcamento');
  content.innerHTML = `<div class="row-actions"><input id="filter" class="search" placeholder="Buscar cliente, placa ou OS"><span class="muted">${rows.length} ordens de serviço</span></div><section class="panel" id="orders-table">${actionTable(rows)}</section>`;
  $('#filter').oninput = event => { const term = event.target.value.toLowerCase(); $('#orders-table').innerHTML = actionTable(rows.filter(o => [o.number, o.customers?.full_name, o.vehicles?.plate].join(' ').toLowerCase().includes(term))); };
};

renderDashboard = async () => {
  const [orders, finance, parts, appointments] = await Promise.all([
    getRows('service_orders', 'id,number,status,total,opened_at,expected_at,completed_at,customers(full_name),vehicles(plate,model)', { order: 'opened_at' }),
    getRows('finance_transactions', 'kind,amount,paid_at,due_date'),
    getRows('parts', 'id,quantity,minimum_quantity'),
    getRows('appointments', 'id,scheduled_at,status,customers(full_name),vehicles(plate)', { order: 'scheduled_at', asc: true, limit: 5 })
  ]);
  const today = new Date(), startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1), activeStatuses = ['aprovada', 'em_execucao', 'aguardando_peca'];
  const active = orders.filter(order => activeStatuses.includes(order.status));
  const pending = orders.filter(order => order.status === 'orcamento');
  const approved = orders.filter(order => activeStatuses.includes(order.status) || ['finalizada', 'entregue'].includes(order.status));
  const approvalBase = approved.length + pending.length + orders.filter(order => order.status === 'cancelada').length;
  const monthlyReceived = finance.filter(x => x.kind === 'receber' && x.paid_at && new Date(x.paid_at) >= startOfMonth).reduce((sum, x) => sum + Number(x.amount), 0);
  const completed = orders.filter(order => ['finalizada', 'entregue'].includes(order.status));
  const ticket = completed.length ? completed.reduce((sum, order) => sum + Number(order.total || 0), 0) / completed.length : 0;
  const overdue = active.filter(order => order.expected_at && new Date(order.expected_at) < today).length;
  const lowStock = parts.filter(part => Number(part.quantity) <= Number(part.minimum_quantity)).length;
  content.innerHTML = `<section class="metric-grid operational-metrics"><article class="metric"><small>OS em andamento</small><strong>${active.length}</strong></article><article class="metric"><small>Faturamento do mês</small><strong>${money.format(monthlyReceived)}</strong></article><article class="metric"><small>Orçamentos pendentes</small><strong>${pending.length}</strong></article><article class="metric"><small>Taxa de aprovação</small><strong>${approvalBase ? Math.round((approved.length / approvalBase) * 100) : 0}%</strong></article><article class="metric"><small>Ticket médio concluído</small><strong>${money.format(ticket)}</strong></article><article class="metric"><small>Serviços atrasados</small><strong>${overdue}</strong></article><article class="metric"><small>Estoque baixo</small><strong>${lowStock}</strong></article></section><section class="grid-two"><article class="panel"><h2>Ordens recentes</h2>${actionTable(orders.filter(o => o.status !== 'orcamento').slice(0, 6))}</article><article class="panel"><h2>Próximos agendamentos</h2>${appointments.length ? appointments.map(a => `<p><strong>${fmtDate(a.scheduled_at)}</strong><br><small>${esc(a.customers?.full_name)} · ${esc(a.vehicles?.plate)}</small></p>`).join('') : '<p class="muted">Nada agendado.</p>'}</article></section>`;
};

renderCustomers = async () => {
  const [customers, vehicles] = await Promise.all([getRows('customers', '*', { order: 'created_at' }), getRows('vehicles', '*,customers(full_name)', { order: 'created_at' })]);
  cache.customers = customers; cache.vehicles = vehicles;
  content.innerHTML = `<div class="row-actions"><span class="muted">Clique em um cliente ou veículo para abrir o histórico completo.</span><button class="secondary-action" id="new-vehicle">+ Novo veículo</button></div><section class="grid-two"><article class="panel"><h2>Clientes</h2>${customers.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nome</th><th>Contato</th><th>Documento</th></tr></thead><tbody>${customers.map(c => `<tr class="clickable-row" data-history-customer="${c.id}"><td><button class="link-button">${esc(c.full_name)}</button></td><td>${esc(c.whatsapp || c.phone || '—')}</td><td>${esc(c.document || '—')}</td></tr>`).join('')}</tbody></table></div>` : empty()}</article><article class="panel"><h2>Veículos</h2>${vehicles.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Placa</th><th>Veículo</th><th>Proprietário</th></tr></thead><tbody>${vehicles.map(v => `<tr class="clickable-row" data-history-vehicle="${v.id}"><td><button class="link-button">${esc(v.plate)}</button></td><td>${esc(v.brand || '')} ${esc(v.model)}<br><small>${esc(v.year || '—')} · ${esc(v.mileage || '—')} km</small></td><td>${esc(v.customers?.full_name)}</td></tr>`).join('')}</tbody></table></div>` : empty()}</article></section>`;
  $('#new-vehicle').onclick = () => openForm('vehicle');
};

async function openHistory(kind, id) {
  const relation = kind === 'customer' ? 'customer_id' : 'vehicle_id';
  const [{ data: entity, error: entityError }, { data: orders, error: ordersError }] = await Promise.all([
    db.from(kind === 'customer' ? 'customers' : 'vehicles').select(kind === 'customer' ? 'full_name,phone,whatsapp,document' : 'plate,brand,model,year,mileage').eq('id', id).single(),
    db.from('service_orders').select('id,number,status,total,opened_at,expected_at,mileage_in,customers(full_name),vehicles(plate,brand,model)').eq(relation, id).order('opened_at', { ascending: false })
  ]);
  if (entityError || ordersError) return alert((entityError || ordersError).message);
  const label = kind === 'customer' ? entity.full_name : `${entity.plate} · ${entity.brand || ''} ${entity.model || ''}`;
  const total = (orders || []).reduce((sum, order) => sum + Number(order.total || 0), 0);
  $('#modal-title').textContent = `Histórico: ${label}`;
  $('#modal-content').innerHTML = `<section class="history-summary"><span>Registros<strong>${orders.length}</strong></span><span>Valor acumulado<strong>${money.format(total)}</strong></span>${kind === 'vehicle' ? `<span>KM atual<strong>${entity.mileage || '—'} km</strong></span>` : ''}</section><div class="table-wrap"><table class="data-table"><thead><tr><th>Registro</th><th>Data</th><th>Status</th><th>KM entrada</th><th>Total</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr><td>#${order.number}</td><td>${fmtDate(order.opened_at)}</td><td><span class="status ${order.status}">${esc(statusLabel(order.status))}</span></td><td>${order.mileage_in || '—'}</td><td>${money.format(order.total || 0)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhum orçamento ou OS registrado.</td></tr>'}</tbody></table></div>`;
  modal.showModal(); $('#close-modal').focus();
}

function renderItemRow(item = {}) {
  const parts = (cache.parts || []).filter(part => part.active !== false);
  const partOptions = `<option value="">Item manual</option>${selectOptions(parts, item.part_id, part => `${part.name}${part.sku ? ` · ${part.sku}` : ''} (${Number(part.quantity)} em estoque)`)}`;
  const type = item.item_type || 'servico';
  return `<div class="budget-item"><select name="item_type"><option value="servico" ${type === 'servico' ? 'selected' : ''}>Mão de obra</option><option value="peca" ${type === 'peca' ? 'selected' : ''}>Peça</option></select><select name="item_part">${partOptions}</select><input name="item_description" placeholder="Descrição do item" value="${esc(item.description || '')}" required><input name="item_quantity" type="number" min=".001" step=".001" value="${item.quantity || 1}" required><input name="item_cost" type="number" min="0" step=".01" value="${item.cost_price || 0}"><input name="item_sale" type="number" min="0" step=".01" value="${item.unit_price || 0}" required><strong class="item-total">${money.format((item.quantity || 1) * (item.unit_price || 0))}</strong><button type="button" class="remove-item" aria-label="Remover item">×</button></div>`;
}

async function openWorkEditor(id = null) {
  let order = null, items = [];
  if (id) {
    const { data, error } = await db.from('service_orders').select('*,service_order_items(id,part_id,item_type,description,quantity,cost_price,unit_price)').eq('id', id).single();
    if (error) return alert(error.message); order = data; items = data.service_order_items || [];
  }
  const customerOptions = `<option value="">Não vincular</option>${selectOptions(cache.customers, order?.customer_id, row => row.full_name)}`;
  const vehicleOptions = `<option value="">Não vincular</option>${selectOptions(cache.vehicles, order?.vehicle_id, row => `${row.plate} · ${row.model}`)}`;
  $('#modal-title').textContent = id ? `Editar ${order.status === 'orcamento' ? 'orçamento' : 'OS'} #${order.number}` : 'Novo orçamento';
  $('#modal-content').innerHTML = fields(`<p class="notice">Peças do estoque preservam o custo e o preço neste orçamento, mesmo que sejam alterados depois no cadastro.</p><div class="form-grid"><label>Cliente cadastrado<select name="customer_id" id="work-customer">${customerOptions}</select></label><label>Veículo cadastrado<select name="vehicle_id" id="work-vehicle">${vehicleOptions}</select></label><label>Nome do cliente<input name="quote_customer_name" value="${esc(order?.quote_customer_name || '')}" placeholder="Cliente avulso"></label><label>Telefone / WhatsApp<input name="quote_customer_phone" value="${esc(order?.quote_customer_phone || '')}"></label><label class="span-2">Veículo / placa<input name="quote_vehicle_description" value="${esc(order?.quote_vehicle_description || '')}" placeholder="Ex.: BMW 320i — ABC1D23"></label>${id ? `<label>Status<select name="status">${['orcamento','aguardando_aprovacao','aprovada','em_execucao','aguardando_peca','finalizada','entregue','cancelada'].map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label>` : ''}<label>Previsão<input name="expected_at" type="datetime-local" value="${order?.expected_at ? new Date(order.expected_at).toISOString().slice(0, 16) : ''}"></label><label>KM de entrada<input name="mileage_in" type="number" min="0" value="${order?.mileage_in || ''}"></label><label class="span-2">Descrição / observações<textarea name="diagnosis">${esc(order?.diagnosis || '')}</textarea></label></div><section class="budget-items"><div class="items-heading"><div><h3>Itens do orçamento</h3><p class="muted">Mão de obra, peças avulsas ou peças vinculadas ao estoque.</p></div><button type="button" class="secondary-action" id="add-budget-item">+ Adicionar item</button></div><div class="budget-item-labels item-labels-extended"><span>Tipo</span><span>Peça do estoque</span><span>Descrição</span><span>Qtd.</span><span>Custo un.</span><span>Venda un.</span><span>Total</span><span></span></div><div id="budget-items-list">${items.map(renderItemRow).join('')}</div><div class="budget-summary"><span>Total de custos: <strong id="budget-cost">${money.format(0)}</strong></span><span>Total de venda: <strong id="budget-total">${money.format(0)}</strong></span><span>Lucro estimado: <strong id="budget-profit">${money.format(0)}</strong></span></div></section>`);
  modal.showModal(); $('#cancel').onclick = () => modal.close();
  const list = $('#budget-items-list');
  const calculate = () => { let cost = 0, total = 0; list.querySelectorAll('.budget-item').forEach(row => { const quantity = Number(row.querySelector('[name="item_quantity"]').value) || 0, itemCost = Number(row.querySelector('[name="item_cost"]').value) || 0, sale = Number(row.querySelector('[name="item_sale"]').value) || 0; cost += quantity * itemCost; total += quantity * sale; row.querySelector('.item-total').textContent = money.format(quantity * sale); }); $('#budget-cost').textContent = money.format(cost); $('#budget-total').textContent = money.format(total); $('#budget-profit').textContent = money.format(total - cost); };
  const bindRow = row => { row.querySelectorAll('input,select').forEach(input => input.addEventListener('input', calculate)); row.querySelector('[name="item_part"]').onchange = event => { const part = (cache.parts || []).find(row => row.id === event.target.value); if (part) { row.querySelector('[name="item_type"]').value = 'peca'; row.querySelector('[name="item_description"]').value = part.name; row.querySelector('[name="item_cost"]').value = part.cost_price || 0; row.querySelector('[name="item_sale"]').value = part.sale_price || 0; calculate(); } }; row.querySelector('.remove-item').onclick = () => { row.remove(); calculate(); }; };
  list.querySelectorAll('.budget-item').forEach(bindRow); if (!items.length) { list.insertAdjacentHTML('beforeend', renderItemRow()); bindRow(list.lastElementChild); } calculate();
  $('#add-budget-item').onclick = () => { list.insertAdjacentHTML('beforeend', renderItemRow({ item_type: 'peca' })); bindRow(list.lastElementChild); calculate(); };
  $('#work-customer').onchange = event => { const customerId = event.target.value; const vehicle = $('#work-vehicle'); if (customerId) vehicle.value = ''; [...vehicle.options].forEach(option => { const item = cache.vehicles.find(row => row.id === option.value); option.hidden = Boolean(customerId && item && item.customer_id !== customerId); }); };
  $('#entity-form').onsubmit = async event => {
    event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget));
    const lineItems = [...list.querySelectorAll('.budget-item')].map(row => ({ part_id: row.querySelector('[name="item_part"]').value || null, item_type: row.querySelector('[name="item_type"]').value, description: row.querySelector('[name="item_description"]').value.trim(), quantity: Number(row.querySelector('[name="item_quantity"]').value), cost_price: Number(row.querySelector('[name="item_cost"]').value) || 0, unit_price: Number(row.querySelector('[name="item_sale"]').value) }));
    if (!lineItems.length || lineItems.some(item => !item.description || !item.quantity)) { $('#form-error').textContent = 'Inclua ao menos um item completo.'; return; }
    for (const key of Object.keys(raw)) if (raw[key] === '') raw[key] = null;
    ['item_type','item_part','item_description','item_quantity','item_cost','item_sale'].forEach(key => delete raw[key]);
    raw.status = raw.status || 'orcamento'; raw.mileage_in = raw.mileage_in === null ? null : Number(raw.mileage_in); raw.labor_total = lineItems.filter(item => item.item_type === 'servico').reduce((sum, item) => sum + item.quantity * item.unit_price, 0); raw.parts_total = lineItems.filter(item => item.item_type === 'peca').reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    let savedId = id;
    if (id) { const { error } = await db.from('service_orders').update(raw).eq('id', id); if (error) { $('#form-error').textContent = error.message; return; } const { error: deleteError } = await db.from('service_order_items').delete().eq('service_order_id', id); if (deleteError) { $('#form-error').textContent = deleteError.message; return; } } else { const { data, error } = await db.from('service_orders').insert(raw).select('id').single(); if (error) { $('#form-error').textContent = error.message; return; } savedId = data.id; }
    const { error: itemError } = await db.from('service_order_items').insert(lineItems.map(item => ({ ...item, service_order_id: savedId }))); if (itemError) { $('#form-error').textContent = itemError.message; return; }
    modal.close(); await render();
  };
}

openBudgetForm = () => openWorkEditor();
const originalOpenForm = openForm;
openForm = kind => kind === 'budget' ? openWorkEditor() : originalOpenForm(kind);

async function approveBudget(id, number) {
  if (!confirm(`Aprovar o orçamento #${number} e gerar a ordem de serviço?`)) return;
  const { error } = await db.from('service_orders').update({ status: 'aprovada', approved_at: new Date().toISOString() }).eq('id', id).eq('status', 'orcamento');
  if (error) return alert(error.message); await render();
}

document.addEventListener('click', event => {
  const approve = event.target.closest('[data-approve-budget]'); if (approve) return approveBudget(approve.dataset.approveBudget, approve.dataset.budgetNumber);
  const edit = event.target.closest('[data-edit-order]'); if (edit) return openWorkEditor(edit.dataset.editOrder);
  const customer = event.target.closest('[data-history-customer]'); if (customer) return openHistory('customer', customer.dataset.historyCustomer);
  const vehicle = event.target.closest('[data-history-vehicle]'); if (vehicle) return openHistory('vehicle', vehicle.dataset.historyVehicle);
});
