import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "대덕.it - 대덕의 IT, 소식을 잇다",
  description: "대덕전자 임직원을 위한 IT 뉴스레터",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        {/* 다크모드 깜빡임(FOUC) 방지 — 페인트 전에 저장된 테마를 html에 적용 (공개/관리자 키 구분) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var k=location.pathname.indexOf('/admin')===0?'admin-dark':'public-dark';if(localStorage.getItem(k)==='1')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-[#0f1117]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
