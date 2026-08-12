document.querySelector('.team-wrapper-block')?.remove();
document.querySelector('[data-w-id="5338943f-a518-b2fb-7365-18922ef24a21"]')?.remove();
document.querySelectorAll('img[srcset]').forEach((image) => image.removeAttribute('srcset'));

const appointmentForm = document.querySelector('#email-form');
const appointmentSuccess = document.querySelector('.success-message');
const appointmentError = document.querySelector('.error-message');

if (appointmentForm) {
  appointmentForm.closest('.w-form')?.classList.remove('w-form');
  appointmentSuccess?.classList.remove('w-form-done');
  appointmentError?.remove();
  if (appointmentSuccess) appointmentSuccess.style.display = 'none';

  appointmentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    appointmentForm.style.display = 'none';
    if (appointmentSuccess) appointmentSuccess.style.display = 'block';
  });
}
