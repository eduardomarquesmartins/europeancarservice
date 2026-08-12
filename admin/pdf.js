const brl = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

async function logoData(){
  const blob=await fetch('../images/EUROPEAN/logo.png').then(response=>response.blob());
  return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
}

async function downloadBudget(number, button){
  if(button){button.disabled=true;button.textContent='Gerando…';}
  try{
    const {data:order,error}=await db.from('service_orders').select('*,customers(full_name,document,phone,whatsapp,address),vehicles(plate,brand,model,year,mileage),service_order_items(description,quantity,unit_price,total,item_type)').eq('number',number).single();
    if(error) throw error;
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({unit:'mm',format:'a4'}), logo=await logoData();
    const customer=order.customers||{}, vehicle=order.vehicles||{}, items=order.service_order_items||[];
    const customerName=customer.full_name||order.quote_customer_name||'Cliente avulso';
    const customerPhone=customer.whatsapp||customer.phone||order.quote_customer_phone||'—';
    const vehicleName=`${vehicle.brand||''} ${vehicle.model||''}`.trim()||order.quote_vehicle_description||'Veículo não informado';
    const addText=(text,x,y,size=10,color=[20,20,20])=>{pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(String(text||'—'),x,y);};
    pdf.setFillColor(10,10,10);pdf.rect(0,0,210,49,'F');
    pdf.addImage(logo,'PNG',15,9.5,45,30);
    pdf.setFont('helvetica','bolditalic');pdf.setFontSize(55);pdf.setTextColor(225,34,44);pdf.text('ORÇAMENTO',195,50,{align:'right'});pdf.setFont('helvetica','normal');
    pdf.setTextColor(20,20,20);pdf.setFontSize(11);pdf.text('Dados do cliente',15,62);pdf.setDrawColor(225,34,44);pdf.setLineWidth(.8);pdf.line(15,65,195,65);
    addText(customerName,15,74,12);addText(`CPF/CNPJ: ${customer.document||'—'}`,15,81,9,[90,90,90]);addText(`Telefone: ${customerPhone}`,15,87,9,[90,90,90]);
    pdf.setFillColor(245,245,245);pdf.roundedRect(15,96,180,25,2,2,'F');addText('VEÍCULO',20,104,8,[225,34,44]);addText(vehicleName,20,112,11);addText(`Placa: ${vehicle.plate||'—'}   •   Ano: ${vehicle.year||'—'}   •   KM: ${vehicle.mileage||'—'}`,20,118,8,[90,90,90]);
    let y=134;pdf.setFillColor(20,20,20);pdf.rect(15,y,180,9,'F');pdf.setTextColor(255,255,255);pdf.setFontSize(8);pdf.text('DESCRIÇÃO',20,y+6);pdf.text('QTD.',127,y+6);pdf.text('UNITÁRIO',145,y+6);pdf.text('TOTAL',190,y+6,{align:'right'});y+=15;
    const lines=items.length?items:[{description:order.diagnosis||order.reported_issue||'Mão de obra',quantity:1,unit_price:order.labor_total||0,total:order.labor_total||0}];
    for(const item of lines){
      if(y>255){pdf.addPage();y=22;}
      const description=pdf.splitTextToSize(item.description||'Serviço',98);pdf.setTextColor(20,20,20);pdf.setFontSize(9);pdf.text(description,20,y);pdf.text(String(item.quantity||1),130,y);pdf.text(brl.format(item.unit_price||0),145,y);pdf.text(brl.format(item.total||0),190,y,{align:'right'});y+=Math.max(8,description.length*5);
      pdf.setDrawColor(225,225,225);pdf.line(20,y-4,190,y-4);
    }
    y+=5;pdf.setFillColor(248,248,248);pdf.roundedRect(121,y,74,31,2,2,'F');addText('TOTAL DO ORÇAMENTO',126,y+9,8,[100,100,100]);pdf.setFontSize(15);pdf.setTextColor(225,34,44);pdf.text(brl.format(order.total||0),190,y+22,{align:'right'});pdf.setFontSize(8);pdf.setTextColor(90,90,90);pdf.text(`Desconto aplicado: ${brl.format(order.discount||0)}`,126,y+28);
    y+=46;if(order.reported_issue){pdf.setFontSize(9);pdf.setTextColor(30,30,30);pdf.text('RELATO DO CLIENTE',15,y);pdf.setFontSize(8);pdf.setTextColor(90,90,90);pdf.text(pdf.splitTextToSize(order.reported_issue,180),15,y+7);}
    pdf.setDrawColor(225,34,44);pdf.line(15,280,195,280);pdf.setFontSize(8);pdf.setTextColor(90,90,90);pdf.text('Orçamento válido por 7 dias. Serviços e peças sujeitos à aprovação do cliente.',15,287);pdf.setTextColor(225,34,44);pdf.text('EUROPEAN PERFORMANCE',195,287,{align:'right'});
    pdf.save(`orcamento-european-car-${order.number}.pdf`);
  }catch(error){alert(`Não foi possível gerar o orçamento: ${error.message||error}`);}finally{if(button){button.disabled=false;button.textContent='Baixar PDF';}}
}

document.addEventListener('click',event=>{const button=event.target.closest('[data-budget-pdf]');if(button)downloadBudget(button.dataset.budgetPdf,button);});
