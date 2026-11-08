<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>جار معالجة عملية الدفع</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#fcfdfd; --ink:#1b2430; --muted:#5d6672; --track:#e6eaee;
  --teal:#2fbf9b; --teal-soft:#bfeadd; --line:#dfe4e8; --dot:#d5dae0;
  box-sizing:border-box;
  padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){--bg:#10171d;--ink:#f0f4f6;--muted:#9aa5ae;--track:#25303a;--teal-soft:#1d5446;--line:#2a343d;--dot:#3a4650}
}
:root[data-theme="dark"]{--bg:#10171d;--ink:#f0f4f6;--muted:#9aa5ae;--track:#25303a;--teal-soft:#1d5446;--line:#2a343d;--dot:#3a4650}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;overflow:hidden;position:relative}
.blob{position:fixed;border-radius:50%;pointer-events:none}
.b1{width:300px;height:300px;top:-150px;left:-110px;background:var(--teal);opacity:.55}
.b1::after{content:"";position:absolute;inset:-40px;border-radius:50%;background:var(--teal-soft);opacity:.45;z-index:-1}
.b2{width:340px;height:340px;bottom:-200px;right:-90px;background:var(--teal);opacity:.6}
.b2::after{content:"";position:absolute;inset:-70px;border-radius:50%;background:var(--teal-soft);opacity:.4;z-index:-1}
main{position:relative;min-height:100%;max-width:480px;margin:0 auto;padding:44px 28px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
.logo{align-self:flex-start;display:flex;align-items:center;gap:14px}
.logo svg{width:64px;height:auto}
.logo b{font-size:34px;line-height:1.05;font-weight:700;display:block;text-align:right}
.logo b span{display:block;font-size:30px}
.ring{position:relative;width:min(300px,72vw);aspect-ratio:1;margin-top:8px}
.ring svg.r{width:100%;height:100%;transform:rotate(-90deg)}
.ring circle{fill:none;stroke-width:22;stroke-linecap:round}
.t{stroke:var(--track)} .p{stroke:var(--teal);transition:stroke-dashoffset 1s linear}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.glass{width:54px;height:74px;transition:transform .8s ease}
.glass.flip{transform:rotate(180deg)}
.num{font-size:64px;font-weight:700;line-height:1;margin-top:6px;font-variant-numeric:tabular-nums}
.unit{font-size:22px;color:var(--muted);font-weight:500}
h1{font-size:34px;font-weight:700;margin:0}
.dots{display:flex;align-items:center;gap:14px;width:100%;margin:22px 0 26px}
.dots i{flex:1;height:1px;background:var(--line)}
.dots span{display:flex;gap:10px}
.dots em{width:12px;height:12px;border-radius:50%;background:var(--dot);animation:pulse 1.5s infinite}
.dots em:nth-child(2){animation-delay:.25s}.dots em:nth-child(3){animation-delay:.5s}
@keyframes pulse{0%,60%,100%{background:var(--dot);transform:scale(1)}30%{background:var(--teal);transform:scale(1.25)}}
p{font-size:21px;line-height:1.8;color:var(--muted);margin:0;max-width:380px}
.mid{display:flex;flex-direction:column;align-items:center;width:100%}
@media (prefers-reduced-motion:reduce){.dots em{animation:none}.glass{transition:none}}
@media (max-height:700px){.num{font-size:48px}h1{font-size:28px}p{font-size:18px}}
</style>
</head>
<body>
<div class="blob b1"></div><div class="blob b2"></div>
<main>
  <div class="logo" role="img" aria-label="أرض الجوال">
    <svg viewBox="0 0 96 130" aria-hidden="true">
      <path d="M14 8h66a10 10 0 0 1 8 16l-26 22H14a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" fill="#eef1f4" stroke="#aeb6bf" stroke-width="2"/>
      <path d="M8 74h70a10 10 0 0 1 6 18l-26 22a10 10 0 0 1-6 2H8a6 6 0 0 1-6-6V80a6 6 0 0 1 6-6z" fill="#2fbf9b" transform="translate(4 4)"/>
    </svg>
    <b><span>أرض</span>الجوال</b>
  </div>

  <div class="ring" role="timer" aria-live="off">
    <svg class="r" viewBox="0 0 300 300" aria-hidden="true">
      <circle class="t" cx="150" cy="150" r="128"/>
      <circle class="p" id="arc" cx="150" cy="150" r="128" stroke-dasharray="804.2" stroke-dashoffset="600"/>
    </svg>
    <div class="center">
      <svg class="glass" id="glass" viewBox="0 0 54 74" aria-hidden="true">
        <rect x="2" y="1" width="50" height="6" rx="2" fill="#2b3640"/>
        <rect x="2" y="67" width="50" height="6" rx="2" fill="#2b3640"/>
        <path d="M9 7h36v10c0 10-8 14-12 20 4 6 12 10 12 20v10H9V57c0-10 8-14 12-20-4-6-12-10-12-20z" fill="none" stroke="#2b3640" stroke-width="4" stroke-linejoin="round"/>
        <path d="M27 36c-3 5-10 9-10 18v7h20v-7c0-9-7-13-10-18z" fill="#2fbf9b"/>
      </svg>
      <div class="num" id="num">30</div>
      <div class="unit">ثانية</div>
    </div>
  </div>

  <div class="mid">
    <h1>جار معالجة عملية الدفع</h1>
    <div class="dots"><i></i><span><em></em><em></em><em></em></span><i></i></div>
    <p>يرجى الانتظار وعدم اغلاق هذه الصفحة حتى اكتمال العملية</p>
  </div>
  <div></div>
</main>
<script>
(function(){
  var total=30,left=total,C=804.2;
  var arc=document.getElementById('arc'),num=document.getElementById('num'),glass=document.getElementById('glass');
  function draw(){
    var progress=0.27+0.73*((total-left)/total);
    arc.style.strokeDashoffset=C*(1-progress);
    num.textContent=left;
  }
  draw();
  var flip=false;
  var id=setInterval(function(){
    if(left<=0){clearInterval(id);return;}
    left--; draw();
    if(left%3===0){flip=!flip;glass.classList.toggle('flip',flip);}
  },1000);
})();
</script>
</body>
</html>
