const DATA = window.SCHEDULE_DATA || [];
const classList = document.querySelector('#classList');
const search = document.querySelector('#search');
const content = document.querySelector('#content');
const tabs = document.querySelector('#dayTabs');
const activeClassEl = document.querySelector('#activeClass');
const resultCount = document.querySelector('#resultCount');
const appShell = document.querySelector('.app-shell');
const main = document.querySelector('.main');
const sidebar = document.querySelector('.sidebar');
const STORAGE_KEY = 'school-timetable-state';
const savedState = (()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch(error){return null}})();
const hasSavedSchedule=!!(savedState&&savedState.class&&savedState.class!=='all');
const initialParams=new URLSearchParams(location.search);
const hasUrlState=['view','class','day','q'].some(key=>initialParams.has(key));
const initialHasSchedule=initialParams.get('view')==='schedule'||['class','day','q'].some(key=>initialParams.has(key));
const legacySchedule=!hasUrlState&&hasSavedSchedule;
const requestedDay=initialHasSchedule?(initialParams.get('day')||'all'):legacySchedule?String(savedState.day||'all'):'all';
const pendingRequestedDay=requestedDay!=='all'&&!DATA.some(day=>day.key===requestedDay)?requestedDay:null;
const startAtHome=initialParams.get('view')==='home'||(!initialHasSchedule&&!legacySchedule);
const homeView = document.createElement('section');
homeView.className = 'home-view';
homeView.id = 'homeView';
main.prepend(homeView);
if(startAtHome)appShell.classList.add('home-mode');
function syncSidebar(){if(sidebar)sidebar.style.display=appShell.classList.contains('home-mode')?'none':''}
syncSidebar();
const homeBtn = document.createElement('button');
homeBtn.className = 'home-btn';
homeBtn.type = 'button';
homeBtn.textContent = '⌂ Главная';
document.querySelector('.topbar').append(homeBtn);
let selectedClass = initialHasSchedule?String(initialParams.get('class')||'all'):legacySchedule?String(savedState.class):'all';
let selectedDay = requestedDay!=='all'&&DATA.some(day=>day.key===requestedDay)?requestedDay:'all';
let pendingUrlDay=pendingRequestedDay;
let autoDayPending = false;
let classes = [];
let LESSON_COLORS = {};
search.value=initialHasSchedule?(initialParams.get('q')||''):'';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1WusumZx4L43imsbdy5WLivlQK0212iyeKHUAII-2ZDY/export?format=csv&gid=861142364';
const SHEET_XLSX_URL = 'https://docs.google.com/spreadsheets/d/1WusumZx4L43imsbdy5WLivlQK0212iyeKHUAII-2ZDY/export?format=xlsx&gid=861142364';
const COLOR_MAP_URL = (()=>{const script=document.querySelector('script[src*="app.js"]'); return script?new URL('lesson-colors.json',script.src).href:'lesson-colors.json'})();

function normalize(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim()}
function subjectParts(raw){const parts=String(raw).split('\n').map(s=>s.trim()).filter(Boolean); const title=(parts[0]||raw).replace(/И\s*Т\s*О\s*Г\s*И\s+М\s*О\s*Д\s*У\s*Л\s*Я/,'И Т О Г И - М О Д У Л Я'); return {title, detail:parts.slice(1).join(' · ')}}
function displayPeriod(period){const match=String(period).match(/^(\d+)(\s*урок)?/i); return match ? match[1] : String(period).replace(' урок','')}
function dayDateParts(day){const match=String(day||'').match(/(\d{1,2})\s+([А-ЯЁа-яё]+)/); return match?{day:Number(match[1]),month:match[2]}:null}
function dayDateLabel(day){const parts=dayDateParts(day.day||day); return parts?parts.day+' '+parts.month:String(day.key||'')}
function lessonColorKey(item){return dayDateLabel(item.day)+'|'+item.period+'|'+item.lesson.class}
function zipEntry(bytes,filename){
  const view=new DataView(bytes),decoder=new TextDecoder(); let end=-1;
  for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0)throw new Error('Invalid timetable export');
  const count=view.getUint16(end+10,true);let cursor=view.getUint32(end+16,true);
  for(let i=0;i<count;i++){
    if(view.getUint32(cursor,true)!==0x02014b50)throw new Error('Invalid timetable archive');
    const method=view.getUint16(cursor+10,true),size=view.getUint32(cursor+20,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true);
    const name=decoder.decode(new Uint8Array(bytes,cursor+46,nameLength));
    if(name===filename){
      const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),start=localOffset+30+localNameLength+localExtraLength,compressed=bytes.slice(start,start+size);
      if(method===0)return decoder.decode(compressed);
      if(method!==8||typeof DecompressionStream==='undefined')throw new Error('Unsupported timetable archive format');
      return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).then(response=>response.text());
    }
    cursor+=46+nameLength+extraLength+commentLength;
  }
  throw new Error('Timetable export is missing '+filename);
}
async function liveSheetColors(){
  const response=await fetch(SHEET_XLSX_URL+'&_='+Date.now(),{cache:'no-store'}); if(!response.ok)throw new Error('Formatted timetable request failed');
  const bytes=await response.arrayBuffer(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',xml=name=>zipEntry(bytes,name),parse=source=>{const doc=new DOMParser().parseFromString(source,'application/xml');if(doc.querySelector('parsererror'))throw new Error('Invalid timetable XML');return doc};
  const [sharedXml,styleXml,sheetXml]=await Promise.all([xml('xl/sharedStrings.xml'),xml('xl/styles.xml'),xml('xl/worksheets/sheet1.xml')]);
  const sharedDoc=parse(sharedXml),styleDoc=parse(styleXml),sheetDoc=parse(sheetXml);
  const strings=Array.from(sharedDoc.getElementsByTagNameNS(ns,'si'),item=>Array.from(item.getElementsByTagNameNS(ns,'t'),node=>node.textContent||'').join(''));
  const fills=Array.from(styleDoc.getElementsByTagNameNS(ns,'fills')[0].children,fill=>{const pattern=fill.getElementsByTagNameNS(ns,'patternFill')[0],color=pattern&&pattern.getElementsByTagNameNS(ns,'fgColor')[0];return pattern&&pattern.getAttribute('patternType')==='solid'&&color&&color.getAttribute('rgb')?'#'+color.getAttribute('rgb').slice(-6):''});
  const styles=Array.from(styleDoc.getElementsByTagNameNS(ns,'cellXfs')[0].children,xf=>fills[Number(xf.getAttribute('fillId')||0)]||'');
  const valueOf=cell=>{const type=cell.getAttribute('t'),v=cell.getElementsByTagNameNS(ns,'v')[0];if(type==='inlineStr')return Array.from(cell.getElementsByTagNameNS(ns,'t'),t=>t.textContent||'').join('');if(!v)return '';const value=v.textContent||'';return type==='s'?(strings[Number(value)]||''):value};
  const colors={},lessonColumns=[2,3,4,5,8,10,12,14,16,18,20];let dateLabel='';
  for(const row of sheetDoc.getElementsByTagNameNS(ns,'row')){
    const cells=Array.from(row.getElementsByTagNameNS(ns,'c')),values=new Map();
    for(const cell of cells){const match=cell.getAttribute('r').match(/^([A-Z]+)\d+$/);if(!match)continue;let col=0;for(const letter of match[1])col=col*26+letter.charCodeAt(0)-64;values.set(col-1,{text:valueOf(cell),style:Number(cell.getAttribute('s')||0)})}
    const rowText=Array.from(values.values(),cell=>cell.text).join(' '),date=rowText.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);if(date)dateLabel=date[1]+' '+date[2].toLowerCase();
    const period=values.get(0)?.text.trim();if(!dateLabel||!/^\d+\s*урок$/i.test(period||''))continue;
    lessonColumns.forEach((column,index)=>{const cell=values.get(column);if(!cell||!cell.text.trim())return;const color=styles[cell.style];if(color)colors[dateLabel+'|'+period+'|'+String(index<4?index+1:index+1)]=color});
  }
  if(!Object.keys(colors).length)throw new Error('No lesson colors found in timetable export');
  return colors;
}
function persistState(push=false){
  const isHome=appShell.classList.contains('home-mode'),params=new URLSearchParams(location.search);
  params.set('view',isHome?'home':'schedule');
  if(isHome){params.delete('class');params.delete('day');params.delete('q')}
  else{params.set('class',selectedClass);params.set('day',selectedDay==='all'&&pendingUrlDay?pendingUrlDay:selectedDay);if(search.value)params.set('q',search.value);else params.delete('q')}
  const query=params.toString(),next=location.pathname+(query?'?'+query:'')+location.hash,current=location.pathname+location.search+location.hash;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({class:selectedClass,day:selectedDay==='all'&&pendingUrlDay?pendingUrlDay:selectedDay,query:search.value,view:isHome?'home':'schedule'}))}catch(error){}
  if(next!==current){if(push)history.pushState({timetable:true},'',next);else history.replaceState({timetable:true},'',next)}
}
function restoreUrlState(){
  const params=new URLSearchParams(location.search),view=params.get('view'),hasSchedule=view==='schedule'||['class','day','q'].some(key=>params.has(key));
  selectedClass=hasSchedule?String(params.get('class')||'all'):'all';
  const day=params.get('day')||'all';selectedDay=day!=='all'&&DATA.some(item=>item.key===day)?day:'all';pendingUrlDay=day!=='all'&&!DATA.some(item=>item.key===day)?day:null;
  search.value=hasSchedule?(params.get('q')||''):'';
  appShell.classList.toggle('home-mode',view==='home'||!hasSchedule);syncSidebar();if(hasSchedule)render();else renderHome();persistState();
}
function todayScheduleKey(){const weekday=new Date().getDay(); if(weekday===6||weekday===2)return 'all'; const key=String(new Date().getDate()); return DATA.some(day=>day.key===key)?key:'all'}
function weekRangeLabel(){const first=DATA[0]&&dayDateParts(DATA[0].day),last=DATA[DATA.length-1]&&dayDateParts(DATA[DATA.length-1].day); if(!first||!last)return 'Расписание онлайн'; const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']; const monthIndex=months.indexOf(first.month.toLowerCase()); if(monthIndex<0)return first.month===last.month?first.day+'–'+last.day+' '+last.month:first.day+' '+first.month+' – '+last.day+' '+last.month; const start=new Date(Date.UTC(new Date().getFullYear(),monthIndex,first.day)); const end=new Date(start); end.setUTCDate(end.getUTCDate()+6); const format=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}); return format.format(start)+' – '+format.format(end)}
function updateWeekMeta(){const range=weekRangeLabel(); const brandRange=document.querySelector('.brand small'); const eyebrow=document.querySelector('.eyebrow'); if(brandRange)brandRange.textContent=range; if(eyebrow)eyebrow.textContent=range}
function rebuildClasses(){classes=[...new Set(DATA.flatMap(d=>d.lessons.flatMap(p=>p.lessons.map(l=>l.class))))].sort((a,b)=>Number(a)-Number(b))}
function renderHome(){
  const hour=new Date().getHours();
  const greeting=hour<5?'Доброй ночи':hour<12?'Доброе утро':hour<18?'Добрый день':'Добрый вечер';
  const date=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  homeView.innerHTML='<div class="home-heading"><div><p class="home-greeting">'+greeting+' 👋</p><h1>Выбери свой класс</h1><p class="home-subtitle">Открой расписание сразу для нужного класса.</p></div><div class="home-date">'+date+'</div></div><div class="grade-grid" id="gradeGrid">'+Array.from({length:11},(_,i)=>{const grade=i+1;const group=grade<5?'Младшая школа':grade<10?'Средняя школа':'Старшая школа';return '<button class="grade-card" type="button" data-grade="'+grade+'"><span class="grade-number">'+grade+'</span><span class="grade-label">класс</span><small>'+group+'</small><span class="grade-arrow">→</span></button>'}).join('')+'</div><p class="home-note">Расписание обновляется из школьной таблицы при каждой загрузке страницы.</p>';
  homeView.querySelectorAll('[data-grade]').forEach(button=>button.addEventListener('click',()=>openSchedule(button.dataset.grade)));
}
function openSchedule(grade){selectedClass=String(grade); selectedDay=todayScheduleKey();pendingUrlDay=null; autoDayPending=true; search.value=''; appShell.classList.remove('home-mode'); syncSidebar(); render(true)}
function openHome(){selectedClass='all'; selectedDay='all';pendingUrlDay=null; search.value=''; appShell.classList.add('home-mode'); syncSidebar(); renderHome();persistState(true)}
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
    if(selectedClass!=='all'){
      if(pendingUrlDay&&DATA.some(day=>day.key===pendingUrlDay))selectedDay=pendingUrlDay;
      else if(pendingUrlDay)selectedDay='all';
      if(autoDayPending&&selectedDay==='all')selectedDay=todayScheduleKey();
    }
    pendingUrlDay=null;
    autoDayPending=false;
    const source=document.querySelector('.side-note');
    if(source)source.innerHTML='<span class="note-dot"></span><div><strong>Источник онлайн</strong><small>Обновлено при загрузке страницы</small></div>';
    render();
  }catch(error){console.warn('Live timetable refresh failed; using embedded fallback.',error)}
}
async function loadLessonColors(){
  try{const response=await fetch(COLOR_MAP_URL+'?_='+Date.now(),{cache:'no-store'}); if(!response.ok)throw new Error('Color map request failed'); Object.assign(LESSON_COLORS,await response.json())}catch(error){console.warn('Saved lesson colors are unavailable.',error)}
  try{Object.assign(LESSON_COLORS,await liveSheetColors())}catch(error){console.warn('Live lesson colors failed; using saved colors.',error)}
  render();
}
function renderClassList(){
  classList.innerHTML = '<button class="class-pill all active" data-class="all">Все классы <span>⌘</span></button>' + classes.map(c=>'<button class="class-pill" data-class="'+c+'">'+c+' класс</button>').join('');
  classList.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{selectedClass=btn.dataset.class; render(true)}));
}
function renderTabs(){
  tabs.innerHTML='<button class="day-tab '+(selectedDay==='all'?'active':'')+'" data-day="all"><span>Вся неделя</span><small>'+DATA.reduce((n,d)=>n+d.lessons.flatMap(p=>p.lessons).length,0)+' уроков</small></button>'+DATA.map(d=>'<button class="day-tab '+(selectedDay===d.key?'active':'')+'" data-day="'+d.key+'"><span>'+d.short+'</span><small>'+d.day.split(',')[1]?.trim()+'</small></button>').join('');
  tabs.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{selectedDay=btn.dataset.day;pendingUrlDay=null; render(true)}));
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
function render(pushUrl=false){
  persistState(pushUrl);
  updateWeekMeta(); renderClassList(); renderTabs();
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
  const fill=LESSON_COLORS[lessonColorKey(item)];
  return '<article class="lesson-card"'+(fill?' style="background-color:'+fill+'"':'')+'><div class="card-top"><span class="date-tag">'+item.day.short+' · '+dayDateLabel(item.day)+'</span><span class="period">'+(item.displayPeriod??displayPeriod(item.period))+'</span></div><h3>'+s.title+'</h3><div class="teacher">'+(s.detail||'')+'</div><div class="card-meta"><span class="meta-icon">◷</span>'+item.time+'<span class="meta-sep">·</span><b>'+item.lesson.class+' кл.</b>'+(item.lesson.room?'<span class="meta-sep">·</span><span>каб. '+item.lesson.room+'</span>':'')+'</div></article>'
}
function dayColumn(day){
  const lessons=day.lessons.flatMap(p=>p.lessons.filter(l=>selectedClass==='all'||l.class===selectedClass).map(l=>({day,...p,lesson:l}))).map((item,index)=>({...item,displayPeriod:selectedClass==='all'?null:String(index)}));
  return '<section class="day-column"><div class="day-heading"><span>'+day.short+'</span><strong>'+dayDateLabel(day)+'</strong><em>'+lessons.length+' уроков</em></div><div class="day-lessons">'+(lessons.length?lessons.map(card).join(''):'<div class="day-empty">Нет уроков</div>')+'</div></section>'
}
search.addEventListener('input',()=>render());
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}});
homeBtn.addEventListener('click',openHome);
window.addEventListener('popstate',restoreUrlState);
rebuildClasses();
render();
renderHome();
loadLiveSchedule();
loadLessonColors();
