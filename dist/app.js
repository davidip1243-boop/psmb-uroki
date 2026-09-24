const DATA = window.SCHEDULE_DATA || [];
const classList = document.querySelector('#classList');
const search = document.querySelector('#search');
const content = document.querySelector('#content');
const tabs = document.querySelector('#dayTabs');
const activeClassEl = document.querySelector('#activeClass');
const resultCount = document.querySelector('#resultCount');
let selectedClass = 'all';
let selectedDay = 'all';
const classes = [...new Set(DATA.flatMap(d => d.lessons.flatMap(p => p.lessons.map(l => l.class))))].sort((a,b)=>Number(a)-Number(b));

function normalize(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim()}
function subjectParts(raw){const parts=String(raw).split('\n').map(s=>s.trim()).filter(Boolean); return {title:parts[0]||raw, detail:parts.slice(1).join(' · ')}}
function displayPeriod(period){const match=String(period).match(/^(\d+)(\s*урок)?/i); return match ? match[1] : String(period).replace(' урок','')}
function renderClassList(){
  classList.innerHTML = '<button class="class-pill all active" data-class="all">Все классы <span>⌘</span></button>' + classes.map(c=>'<button class="class-pill" data-class="'+c+'">'+c+' класс</button>').join('');
  classList.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{selectedClass=btn.dataset.class; render()}));
}
function renderTabs(){
  tabs.innerHTML='<button class="day-tab '+(selectedDay==='all'?'active':'')+'" data-day="all"><span>Вся неделя</span><small>'+DATA.reduce((n,d)=>n+d.lessons.flatMap(p=>p.lessons).length,0)+' уроков</small></button>'+DATA.map(d=>'<button class="day-tab '+(selectedDay===d.key?'active':'')+'" data-day="'+d.key+'"><span>'+d.short+'</span><small>'+d.day.split(',')[1]?.trim()+'</small></button>').join('');
  tabs.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{selectedDay=btn.dataset.day; render()}));
}
function getMatches(){
  const q=normalize(search.value);
  return DATA.filter(d=>selectedDay==='all'||d.key===selectedDay).flatMap(d=>{
    const lessons=d.lessons.flatMap(p=>p.lessons.filter(l=>selectedClass==='all'||l.class===selectedClass).map(l=>({day:d,...p,lesson:l})));
    return lessons.map((item,index)=>({...item,displayPeriod:selectedClass==='all'?null:String(index)})).filter(item=>{
      const hay=normalize([d.day,item.period,item.time,item.lesson.class,item.lesson.subject,item.lesson.room].join(' '));
      return !q||hay.includes(q);
    });
  });
}
function render(){
  renderClassList(); renderTabs();
  classList.querySelectorAll('[data-class]').forEach(b=>b.classList.toggle('active',b.dataset.class===selectedClass));
  activeClassEl.textContent=selectedClass==='all'?'всех классов':selectedClass+' класса';
  const matches=getMatches(); resultCount.textContent=matches.length+' '+(matches.length===1?'урок':matches.length<5?'урока':'уроков');
  if(!matches.length){content.innerHTML='<div class="empty"><div class="empty-icon">⌕</div><h2>Ничего не найдено</h2><p>Попробуй другой предмет, учителя, класс или кабинет.</p></div>';return}
  if(search.value||selectedDay!=='all'){
    content.innerHTML='<div class="results-head"><div><span class="section-kicker">РЕЗУЛЬТАТЫ ПОИСКА</span><h2>'+ (search.value?'Совпадения для «'+search.value+'»':selectedDay==='all'?'Все уроки недели':DATA.find(d=>d.key===selectedDay).day) +'</h2></div><span class="count-badge">'+matches.length+' найдено</span></div><div class="result-grid">'+matches.map(card).join('')+'</div>';
  } else {
    content.innerHTML='<div class="results-head"><div><span class="section-kicker">РАСПИСАНИЕ НЕДЕЛИ</span><h2>Все уроки на виду</h2></div><span class="count-badge">выбери день или класс</span></div><div class="week-grid">'+DATA.map(d=>dayColumn(d)).join('')+'</div>';
  }
}
function card(item){
  const s=subjectParts(item.lesson.subject);
  return '<article class="lesson-card"><div class="card-top"><span class="date-tag">'+item.day.short+' · '+item.day.key+' сен.</span><span class="period">'+(item.displayPeriod??displayPeriod(item.period))+'</span></div><h3>'+s.title+'</h3><div class="teacher">'+(s.detail||'')+'</div><div class="card-meta"><span class="meta-icon">◷</span>'+item.time+'<span class="meta-sep">·</span><b>'+item.lesson.class+' кл.</b>'+(item.lesson.room?'<span class="meta-sep">·</span><span>каб. '+item.lesson.room+'</span>':'')+'</div></article>'
}
function dayColumn(day){
  const lessons=day.lessons.flatMap(p=>p.lessons.filter(l=>selectedClass==='all'||l.class===selectedClass).map(l=>({day,...p,lesson:l}))).map((item,index)=>({...item,displayPeriod:selectedClass==='all'?null:String(index)}));
  return '<section class="day-column"><div class="day-heading"><span>'+day.short+'</span><strong>'+day.key+' сентября</strong><em>'+lessons.length+' уроков</em></div><div class="day-lessons">'+(lessons.length?lessons.map(card).join(''):'<div class="day-empty">Нет уроков</div>')+'</div></section>'
}
search.addEventListener('input',render);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}});
document.querySelector('#todayBtn').addEventListener('click',()=>{selectedDay='21';render()});
render();
