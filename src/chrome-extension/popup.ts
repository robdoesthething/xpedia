import { signIn, signOut, getStoredEmail } from './lib/auth.js';

const loginView = document.getElementById('login-view') as HTMLDivElement;
const loggedInView = document.getElementById('logged-in-view') as HTMLDivElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const signInBtn = document.getElementById('sign-in-btn') as HTMLButtonElement;
const signOutBtn = document.getElementById('sign-out-btn') as HTMLButtonElement;
const userEmailEl = document.getElementById('user-email') as HTMLSpanElement;

async function init() {
  const email = await getStoredEmail();
  if (email) {
    showLoggedIn(email);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.style.display = 'block';
  loggedInView.style.display = 'none';
}

function showLoggedIn(email: string) {
  loginView.style.display = 'none';
  loggedInView.style.display = 'block';
  userEmailEl.textContent = email;
}

signInBtn.addEventListener('click', async () => {
  errorEl.textContent = '';
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    return;
  }

  signInBtn.textContent = 'Signing in...';
  signInBtn.disabled = true;

  const result = await signIn(email, password);

  signInBtn.textContent = 'Sign In';
  signInBtn.disabled = false;

  if ('error' in result) {
    errorEl.textContent = result.error;
  } else {
    showLoggedIn(result.email);
  }
});

signOutBtn.addEventListener('click', async () => {
  await signOut();
  showLogin();
});

init();
