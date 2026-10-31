/**
 * Standalone page shown inside the dashboard's live-preview iframe
 * (sandbox="allow-scripts"). It draws a faint fake website and loads the embed
 * script in preview mode; the editor then posts a PreviewMessage to render the
 * widget being edited (see PreviewMessage in src/widget/types.ts).
 */

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Widget preview</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{--bg:#f5f5f8;--card:#ffffff;--blk:#e7e6ee;--blk2:#efeef4;--line:#e9e8ef;color-scheme:light}
html.dark{--bg:#111016;--card:#1a1920;--blk:#2a2933;--blk2:#22212a;--line:#24232c;color-scheme:dark}
body{background:var(--bg);min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;transition:background .2s}
.top{display:flex;align-items:center;gap:14px;height:58px;padding:0 6%;background:var(--card);border-bottom:1px solid var(--line)}
.logo{width:28px;height:28px;border-radius:8px;background:var(--blk)}
.brand{width:90px;height:12px;border-radius:6px;background:var(--blk)}
.nav{display:flex;gap:16px;margin-inline-start:auto}
.nav i{display:block;width:52px;height:10px;border-radius:5px;background:var(--blk2)}
.nav i:last-child{width:84px;height:30px;border-radius:8px;background:var(--blk)}
main{max-width:980px;margin:0 auto;padding:56px 6% 80px}
.l{height:14px;border-radius:7px;background:var(--blk2);margin-bottom:14px}
.h1{height:34px;width:62%;border-radius:10px;background:var(--blk);margin-bottom:18px}
.h2{height:34px;width:44%;border-radius:10px;background:var(--blk);margin-bottom:28px}
.btns{display:flex;gap:12px;margin:30px 0 56px}
.btns i{display:block;width:130px;height:42px;border-radius:10px;background:var(--blk)}
.btns i+i{background:var(--blk2)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;height:170px}
.card .img{height:64px;border-radius:10px;background:var(--blk2);margin-bottom:16px}
.w90{width:90%}.w80{width:80%}.w70{width:70%}.w55{width:55%}.w40{width:40%}
</style>
</head>
<body>
<div class="top" aria-hidden="true"><div class="logo"></div><div class="brand"></div><div class="nav"><i></i><i></i><i></i><i></i></div></div>
<main aria-hidden="true">
<div class="h1"></div><div class="h2"></div>
<div class="l w90"></div><div class="l w80"></div><div class="l w55"></div>
<div class="btns"><i></i><i></i></div>
<div class="grid">
<div class="card"><div class="img"></div><div class="l w80"></div><div class="l w55"></div></div>
<div class="card"><div class="img"></div><div class="l w70"></div><div class="l w40"></div></div>
<div class="card"><div class="img"></div><div class="l w90"></div><div class="l w55"></div></div>
</div>
</main>
<script src="/w.js" data-preview="1"></script>
</body>
</html>
`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src * data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      "X-Robots-Tag": "noindex",
    },
  });
}
