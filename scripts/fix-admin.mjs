import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "../data/daeduck.db"));

db.prepare("UPDATE users SET name = '관리자' WHERE email = 'admin@daeduck.com'").run();

const users = db.prepare("SELECT id, name, email, role FROM users").all();
console.log("수정 완료:", users);
db.close();
