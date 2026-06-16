/**
 * 최초 관리자 계정 생성 스크립트
 * 실행: node scripts/create-admin.mjs
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const SETUP_KEY = process.env.SETUP_KEY || "daeduck-setup-2024";

const admin = {
  name: "관리자",
  email: "admin@daeduck.com",
  password: "daeduck1234!",
};

const res = await fetch(`${BASE_URL}/api/setup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ setupKey: SETUP_KEY, ...admin }),
});

const data = await res.json();
if (res.ok) {
  console.log("✅ 관리자 계정 생성 완료!");
  console.log(`   이메일: ${admin.email}`);
  console.log(`   비밀번호: ${admin.password}`);
  console.log(`   로그인: ${BASE_URL}/admin/login`);
} else {
  console.error("❌ 오류:", data.error);
}
