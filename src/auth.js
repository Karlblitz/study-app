const USERS_KEY = "studyspace-users";
const HASH_ITERATIONS = 310000;
const encoder = new TextEncoder();

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: HASH_ITERATIONS, hash: "SHA-256" }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export async function createLocalAccount({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = getUsers();
  if (users.some((user) => user.email === normalizedEmail)) throw new Error("An account with this email already exists. Sign in instead.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  users.push({ name: name.trim(), email: normalizedEmail, salt: toBase64(salt), passwordHash });
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return { name: name.trim(), email: normalizedEmail, source: "local" };
}

export async function signInLocalAccount({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const account = getUsers().find((user) => user.email === normalizedEmail);
  if (!account) throw new Error("No account was found for this email. Create an account first.");
  const salt = Uint8Array.from(atob(account.salt), (character) => character.charCodeAt(0));
  const enteredHash = await hashPassword(password, salt);
  if (enteredHash !== account.passwordHash) throw new Error("The email or password is incorrect.");
  return { name: account.name, email: account.email, source: "local" };
}
