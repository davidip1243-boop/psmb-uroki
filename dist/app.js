const DATA = window.SCHEDULE_DATA || [];
const classList = document.querySelector('#classList');
const search = document.querySelector('#search');
const content = document.querySelector('#content');
const tabs = document.querySelector('#dayTabs');
const activeClassEl = document.querySelector('#activeClass');
const resultCount = document.querySelector('#resultCount');
const appShell = document.querySelector('.app-shell');
const main = document.querySelector('.main');
const todayBtn = document.querySelector('#todayBtn');
const homeView = document.createElement('section');
homeView.className = 'home-view';
homeView.id = 'homeView';
main.prepend(homeView);
appShell.classList.add('home-mode');
const homeBtn = document.createElement('button');
homeBtn.className = 'home-btn';
homeBtn.type = 'button';
homeBtn.textContent = '⌂ Главная';
todayBtn.parentNode.insertBefore(homeBtn,todayBtn);
let selectedClass = 'all';
let selectedDay = 'all';
let classes = [];
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1WusumZx4L43imsbdy5WLivlQK0212iyeKHUAII-2ZDY/export?format=csv&gid=861142364';

function normalize(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim()}
function subjectParts(raw){const parts=String(raw).split('\n').map(s=>s.trim()).filter(Boolean); return {title:parts[0]||raw, detail:parts.slice(1).join(' · ')}}
function displayPeriod(period){const match=String(period).match(/^(\d+)(\s*урок)?/i); return match ? match[1] : String(period).replace(' урок','')}
function rebuildClasses(){classes=[...new Set(DATA.flatMap(d=>d.lessons.flatMap(p=>p.lessons.map(l=>l.class))))].sort((a,b)=>Number(a)-Number(b))}
function renderHome(){
  const hour=new Date().getHours();
  const greeting=hour<5?'Доброй ночи':hour<12?'Доброе утро':hour<18?'Добрый день':'Добрый вечер';
  const date=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  homeView.innerHTML='<div class="home-kicker">ШКОЛЬНЫЙ ПОРТАЛ</div><div class="home-heading"><div><p class="home-greeting">'+greeting+' 👋</p><h1>Выбери свой класс</h1><p class="home-subtitle">Открой расписание сразу для нужного класса.</p></div><div class="home-date">'+date+'</div></div><div class="grade-grid" id="gradeGrid">'+Array.from({length:11},(_,i)=>{const grade=i+1;const group=grade<5?'Младшая школа':grade<10?'Средняя школа':'Старшая школа';return '<button class="grade-card" type="button" data-grade="'+grade+'"><span class="grade-number">'+grade+'</span><span class="grade-label">класс</span><small>'+group+'</small><span class="grade-arrow">→</span></button>'}).join('')+'</div><p class="home-note">Расписание обновляется из школьной таблицы при каждой загрузке страницы.</p>';
  homeView.querySelectorAll('[data-grade]').forEach(button=>button.addEventListener('click',()=>openSchedule(button.dataset.grade)));
}
function openSchedule(grade){selectedClass=String(grade); selectedDay='all'; search.value=''; appShell.classList.remove('home-mode'); render()}
function openHome(){selectedClass='all'; selectedDay='all'; search.value=''; appShell.classList.add('home-mode'); renderHome()}
function parseCsv(text){
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i], next=text[i+1];
    if(char==='"'&&quoted&&next==='"'){cell+='"'; i++; continue}
    if(char==='"'){quoted=!quoted; continue}
    if(char===','&&!quoted){row.push(cell); cell=''; continue}
    if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++; row.push(cell); rows.push(row); row=[]; cell=''; continue}
    cell+=char;
  }
  if(cell||row.length){row.push(cell); rows.push(row)}
  return rows;
}
function parseLiveSchedule(csv){
  const rows=parseCsv(csv), days=[], upperClasses=['5','6','7','8','9','10','11'], upperSubjectCols=[8,10,12,14,16,18,20];
  let current=null;
  rows.forEach(row=>{
    const header=row.find(value=>/[А-ЯЁ]\s*,\s*\d{1,2}\s+[А-ЯЁа-яё]+/.test(String(value||'')));
    if(header){
      const date=String(header).match(/(\d{1,2})\s+[А-ЯЁа-яё]+/);
      const dayName=String(header).split(',')[0].replace(/\s+/g,'').toLowerCase();
      const short=dayName.includes('понедельник')?'Пн':dayName.includes('вторник')?'Вт':dayName.includes('среда')?'Ср':dayName.includes('четверг')?'Чт':'Пт';
      current={key:date?date[1]:String(days.length+1),day:String(header).trim(),short,lessons:[]}; days.push(current); return;
    }
    if(!current)return;
    const period=row.find(value=>/^\d+\s*урок$/i.test(String(value||'').trim()));
    if(!period)return;
    const periodIndex=row.findIndex(value=>/^\d+\s*урок$/i.test(String(value||'').trim()));
    const time=String(row[periodIndex+1]||row[1]||'').trim();
    const lessons=[];
    for(let i=0;i<4;i++){const subject=String(row[periodIndex+2+i]||'').trim(); if(subject)lessons.push({class:String(i+1),subject,room:''})}
    upperClasses.forEach((className,i)=>{const subject=String(row[upperSubjectCols[i]]||'').trim(); if(subject)lessons.push({class:className,subject,room:String(row[upperSubjectCols[i]+1]||'').trim()})});
    if(lessons.length)current.lessons.push({period:String(period).trim(),time,lessons});
  });
  return days.filter(day=>day.lessons.length);
}
async function loadLiveSchedule(){
  try{
    const response=await fetch(SHEET_CSV_URL+'&_='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('Sheet request failed');
    const live=parseLiveSchedule(await response.text());
    if(!live.length)throw new Error('No lessons found');
    DATA.splice(0,DATA.length,...live); rebuildClasses();
    const source=document.querySelector('.side-note');
    if(source)source.innerHTML='<span class="note-dot"></span><div><strong>Источник онлайн</strong><small>Обновлено при загрузке страницы</small></div>';
    render();
  }catch(error){console.warn('Live timetable refresh failed; using embedded fallback.',error)}
}
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
todayBtn.addEventListener('click',()=>{selectedDay=DATA[0]?.key||'21';appShell.classList.remove('home-mode');render()});
homeBtn.addEventListener('click',openHome);
rebuildClasses();
render();
renderHome();
loadLiveSchedule();
