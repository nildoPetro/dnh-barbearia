const cfg=window.DNH_CONFIG||{};const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let profile=null,settings={},CURRENT_SLUG=new URLSearchParams(window.location.search).get('b')||localStorage.getItem('dnh_slug')||'dnh';
let selectedHora=null,editServId=null,editEstId=null,editFuncId=null,editBookingId=null,estoqueVisivel=true,financeiroVisivel=false,graficoVisivel=false;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(m){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}el.textContent=m;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4000);}
function go(page){$$('.page').forEach(p=>p.classList.remove('active'));$('#page-'+page)?.classList.add('active');$$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#sidebar')?.classList.remove('open');$('#overlay')?.classList.remove('show');if(page==='dashboard')loadDash();if(page==='agenda')loadAgenda();if(page==='servicos')loadServ();if(page==='estoque')loadEst();if(page==='funcionarios')loadFunc();if(page==='financeiro')loadFin();if(page==='settings')loadSet();}
function applyLogo(url){if(!url)return;['#logoSidebar','#logoDash','#logoLogin'].forEach(sel=>{const el=$(sel);if(el){el.src=url;el.style.display='block';}});}
async function loadPublicLogo(){try{const{data}=await sb.from('settings').select('name,logo_url').eq('slug',CURRENT_SLUG).maybeSingle();if(data){if(data.logo_url){const el=$('#logoLogin');if(el){el.src=data.logo_url;el.style.display='block';}applyLogo(data.logo_url);}if(data.name){$('#shopNameLogin').textContent=data.name.toUpperCase();$('#barberName').textContent=data.name;}if($('#slugDisplay'))$('#slugDisplay').textContent=CURRENT_SLUG;if($('#barberSlug'))$('#barberSlug').textContent=CURRENT_SLUG;}}catch(e){}}
async function loadSet(){let data=null;try{const r=await sb.from('settings').select('*').eq('slug',CURRENT_SLUG).maybeSingle();if(r.data)data=r.data;}catch(e){}if(data){settings={...settings,...data};$('#setName').value=settings.name||'';$('#setWhatsapp').value=settings.whatsapp||'';$('#setStart').value=(settings.start_time||'08:00').slice(0,5);$('#setEnd').value=(settings.end_time||'18:00').slice(0,5);$('#setInterval').value=settings.slot_interval||30;$('#setLogoUrl').value=settings.logo_url||'';$('#setLunchStart').value=(settings.lunch_start||'12:00').slice(0,5);$('#setLunchEnd').value=(settings.lunch_end||'13:00').slice(0,5);applyLogo(settings.logo_url);if($('#logoPreview')){$('#logoPreview').src=settings.logo_url;$('#logoPreview').style.display=settings.logo_url?'block':'none';}}if($('#weeklyBox')&&!$('#weeklyBox').dataset.done){const f=(e,s,en)=>({enabled:e,start:s,end:en});const st=settings.start_time?.slice(0,5)||'08:00';const en=settings.end_time?.slice(0,5)||'18:00';const fb={0:f(false,st,en),1:f(true,st,en),2:f(true,st,en),3:f(true,st,en),4:f(true,st,en),5:f(true,st,en),6:f(false,st,en)};const cur=settings.weekly_schedule||{};const weekly=Object.fromEntries(Object.keys(fb).map(k=>[k,{...fb[k],...(cur[k]||{})}]));let h='';Object.entries({1:'Segunda',2:'Terça',3:'Quarta',4:'Quinta',5:'Sexta',6:'Sábado',0:'Domingo'}).forEach(([k,n])=>{const c=weekly[k]||{};h+=`<div class="day-row" data-weekday="${k}"><b>${n}</b><label><input type="checkbox" data-week-enabled ${c.enabled!==false?'checked':''}> Atende</label><input type="time" data-week-start value="${c.start||'08:00'}"><input type="time" data-week-end value="${c.end||'18:00'}"></div>`;});$('#weeklyBox').innerHTML=h;$('#weeklyBox').dataset.done='1';}}
async function loadDash(){const hoje=today();$('#dashDate').textContent=hoje.split('-').reverse().join('/');const{data:books=[]}=await sb.from('bookings').select('*,services(name,price)').eq('slug',CURRENT_SLUG).eq('booking_date',hoje).order('booking_time');const ok=books.filter(b=>b.status!=='cancelled');const pagos=ok.filter(b=>b.paid===true);const receita=pagos.reduce((a,b)=>a+Number(b.price||b.services?.price||0),0);$('#dashHoje').textContent=ok.length;$('#dashClientes').textContent=ok.length;$('#dashReceita').textContent=money(receita);$('#dashTicket').textContent=money(ok.length?receita/ok.length:0);$('#dashHojeObs').textContent=`${pagos.length} pagos de ${ok.length}`;$('#todayAgenda').innerHTML=ok.length?ok.map(b=>`<div class="list-row"><div><b>${(b.booking_time||'').slice(0,5)}</b> - ${esc(b.client_name||'')} <small style="display:block;color:#8a8fa3">${esc(b.phone||'')} • ${esc(b.services?.name||'')} • ${b.paid?'✅ Pago':'⏳ Não pago'}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button data-edit-book="${b.id}" class="btn small">✏️</button><button data-toggle-paid="${b.id}" class="btn small ${b.paid?'':'gold'}">${b.paid?'Desmarcar':'Pagar'}</button><button data-cancel-book="${b.id}" class="btn small danger">X</button></div></div>`).join(''):'<p style="color:#666">Nenhum hoje</p>';const{data:est=[]}=await sb.from('stock').select('*').eq('slug',CURRENT_SLUG);const alertas=est.filter(e=>Number(e.quantity||0)<=Number(e.min_quantity||0));$('#dashEstoque').innerHTML=alertas.length?alertas.map(e=>`<div class="list-row estoque-alerta"><div><b>${esc(e.name)}</b><small>Qtd:${e.quantity} Min:${e.min_quantity}</small></div><span>⚠️</span></div>`).join(''):'<p style="color:#4ade80">✅ Estoque OK</p>';}
async function loadAgenda(){await loadSet();const hoje=today();if($('#agData'))$('#agData').value=hoje;const{data:servs=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).eq('active',true);$('#agServico').innerHTML=servs.map(s=>`<option value="${s.id}">${esc(s.name)} - ${money(s.price)} (${s.duration}min)</option>`).join('')||'<option value="">Cadastre serviço</option>';const{data:funcs=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).eq('active',true);$('#agFuncionario').innerHTML=funcs.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')||'<option value="">Dono</option>';await gerarHorariosDisponiveis();await listarAgendaDia();}
async function gerarHorariosDisponiveis(){const dataSel=$('#agData')?.value||today();const barbeiroId=$('#agFuncionario')?.value||null;const selGrid=$('#agHoraGrid');if(!selGrid)return;selGrid.innerHTML='Carregando...';const start=settings.start_time?.slice(0,5)||'08:00',end=settings.end_time?.slice(0,5)||'18:00',interval=Number(settings.slot_interval||30);const lunchS=settings.lunch_start?.slice(0,5)||'12:00',lunchE=settings.lunch_end?.slice(0,5)||'13:00';const weekly=settings.weekly_schedule||{};const dia=new Date(dataSel+'T12:00:00').getDay();const cfgDia=weekly[dia];if(cfgDia&&cfgDia.enabled===false){selGrid.innerHTML='<small style="color:#f87171">Fechado neste dia</small>';return;}let q=sb.from('bookings').select('booking_time').eq('slug',CURRENT_SLUG).eq('booking_date',dataSel).neq('status','cancelled');if(barbeiroId)q=q.eq('professional_id',barbeiroId);const{data:ocupados=[]}=await q;const ocupSet=new Set(ocupados.map(o=>(o.booking_time||'').slice(0,5)));let h=Number(start.split(':')[0]),m=Number(start.split(':')[1]);const [eh,em]=end.split(':').map(Number);const [lh,lm]=lunchS.split(':').map(Number);const [lhe,lme]=lunchE.split(':').map(Number);let html='';while(h<eh||(h===eh&&m<em)){const t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;const cur=h*60+m,lS=lh*60+lm,lE=lhe*60+lme;if(!(cur>=lS&&cur<lE)){const ocupado=ocupSet.has(t);html+=`<button data-hora="${t}" class="btn small ${ocupado?'danger':''}" style="${ocupado?'opacity:.4':(selectedHora===t?'background:var(--gold);color:#000':'')}" ${ocupado?'disabled':''}>${t}${ocupado?'•ocup':''}</button>`;}m+=interval;if(m>=60){m-=60;h++;}}selGrid.innerHTML=html||'<small>Sem horários</small>';selGrid.querySelectorAll('[data-hora]').forEach(btn=>{btn.onclick=()=>{selectedHora=btn.dataset.hora;selGrid.querySelectorAll('[data-hora]').forEach(b=>{b.style.background='';b.style.color='';});btn.style.background='var(--gold)';btn.style.color='#000';};});}
async function listarAgendaDia(){const dataSel=$('#agData')?.value||today();const{data:books=[]}=await sb.from('bookings').select('*,services(name,price)').eq('slug',CURRENT_SLUG).eq('booking_date',dataSel).order('booking_time');$('#adminAgendaList').innerHTML=`<h3>Agenda ${dataSel.split('-').reverse().join('/')} - ${books.length} agend.</h3>`+(books.length?books.map(b=>`<div class="list-row"><div><b>${(b.booking_time||'').slice(0,5)}</b> - ${esc(b.client_name||'')} - ${esc(b.phone||'')}<small style="display:block">${esc(b.services?.name||'')} • ${b.paid?'✅ Pago':'⏳ Não pago'}</small></div><div style="display:flex;gap:6px"><button data-edit-book="${b.id}" class="btn small">Editar</button><button data-cancel-book="${b.id}" class="btn small danger">Cancelar</button></div></div>`).join(''):'<p style="color:#666">Sem agendamentos</p>');}
async function loadServ(){const{data:servs=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).order('name');$('#listaServicos').innerHTML=servs.map(s=>`<div class="list-row"><div><b>${esc(s.name)}</b><small>${money(s.price)} • ${s.duration}min</small></div><div style="display:flex;gap:6px"><button data-edit-serv="${s.id}" class="btn small">✏️ Editar</button><button data-del-serv="${s.id}" class="btn small danger">Excluir</button></div></div>`).join('')||'<p style="color:#666">Nenhum</p>';}
async function loadEst(){
 const {data:catalog=[]} = await sb.from('product_catalog').select('*').eq('slug',CURRENT_SLUG).order('name');
 const {data:items=[]}=await sb.from('stock').select('*').eq('slug',CURRENT_SLUG).order('name');
 $('#estNome').innerHTML = catalog.length ? catalog.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('') : '<option value="">Cadastre produto no catálogo acima</option>';
 $('#retiradaProduto').innerHTML='<option value="">Selecione...</option>'+items.map(i=>`<option value="${i.id}" data-qtd="${i.quantity}">${esc(i.name)} (Qtd em estoque: ${i.quantity})</option>`).join('');
 if(!estoqueVisivel){$('#listaEstoque').innerHTML='<p style="color:var(--text)">Recolhido</p>';return;}
 $('#listaEstoque').innerHTML=items.map(i=>{const al=Number(i.quantity)<=Number(i.min_quantity);return `<div class="list-row ${al?'estoque-alerta':''}"><div><b>${esc(i.name)}</b><small>Qtd:${i.quantity} Min:${i.min_quantity} Custo:${money(i.cost)}</small>${al?'<br><span style="color:#ff6b6b">⚠️ ABAIXO MÍNIMO</span>':''}</div><div style="display:flex;gap:6px"><button data-edit-est="${i.id}" class="btn small">✏️</button><button data-del-est="${i.id}" class="btn small danger">X</button></div></div>`;}).join('')||'<p style="color:#666">Nenhum produto no estoque - adicione usando a lista do catálogo</p>';
}
async function loadFunc(){const{data:funcs=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).order('name');$('#listaFuncionarios').innerHTML=funcs.map(f=>`<div class="list-row"><div><b>${esc(f.name)}</b><small>${esc(f.phone||'')} • ${esc(f.perfil)} • ${f.start_time||''}-${f.end_time||''}</small></div><div style="display:flex;gap:6px"><button data-edit-func="${f.id}" class="btn small">✏️ Editar</button><button data-del-func="${f.id}" class="btn small danger">Excluir</button></div></div>`).join('')||'<p style="color:#666">Nenhum</p>';}

async function loadFin(){
 const hoje=today();
 if($('#finData'))$('#finData').value=hoje;
 if($('#finInicio'))$('#finInicio').value=hoje;
 if($('#finFim'))$('#finFim').value=hoje;
 const {data:manualEntries=[]} = await sb.from('cash_entries').select('*').eq('slug',CURRENT_SLUG).eq('entry_date',hoje).order('created_at',{ascending:true});
 const {data:booksPaid=[]} = await sb.from('bookings').select('*,services(price)').eq('slug',CURRENT_SLUG).eq('booking_date',hoje).eq('paid',true).neq('status','cancelled').order('booking_time');
 const autoEntries = booksPaid.map(b=>{
   const jaExiste = manualEntries.find(m=>m.booking_id===b.id);
   if(jaExiste) return null;
   return {
     id: 'auto-'+b.id,
     type: 'income',
     amount: b.price || b.services?.price || 0,
     entry_date: b.booking_date,
     category: 'servico',
     payment_method: 'auto',
     description: `Pagamentos no aplicativo - ${b.client_name} ${b.booking_time?.slice(0,5)} (${b.services?.name||'serviço'})`,
     booking_id: b.id,
     is_auto: true,
     created_at: b.created_at
   };
 }).filter(Boolean);
 const allEntries = [...manualEntries, ...autoEntries].sort((a,b)=> new Date(a.created_at||a.entry_date) - new Date(b.created_at||b.entry_date));
 renderFin(allEntries,true);
}
function renderFin(entries,isToday=false){
 const inc=entries.filter(e=>e.type==='income').reduce((a,b)=>a+Number(b.amount||0),0);
 const exp=entries.filter(e=>e.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0);
 $('#finResumo').innerHTML=`<div class="metric-card"><small>${isToday?'Hoje':''} Entradas</small><b style="color:#4ade80">${money(inc)}</b><small style="display:block;color:var(--text)">${entries.filter(e=>e.type==='income').length} lançamentos (Manual + Pagamentos no app)</small></div><div class="metric-card"><small>Saídas</small><b style="color:#f87171">${money(exp)}</b></div><div class="metric-card"><small>Líquido</small><b style="color:${inc-exp>=0?'#4ade80':'#f87171'}">${money(inc-exp)}</b></div>`;
 if(financeiroVisivel){
   $('#listaFinanceiro').classList.remove('hidden');
   $('#listaFinanceiro').innerHTML=entries.map(e=>{
     const isAuto = e.is_auto || e.payment_method==='auto' || (e.description||'').includes('Pagamentos no aplicativo');
     return `<div class="list-row" style="${isAuto?'border-left:3px solid var(--gold)':''}"><div><b style="color:${e.type==='income'?'#4ade80':'#f87171'}">${e.type==='income'?'+':'-'} ${money(e.amount)}</b> ${esc(e.description||e.category||'servico')} ${isAuto?'<span style="background:var(--gold);color:#000;font-size:9px;padding:2px 6px;border-radius:10px;margin-left:6px">APP</span>':''}<small style="display:block;color:#8a8fa3">${e.entry_date} • ${esc(e.category||'servico')} • ${esc(e.payment_method||'pix')} ${isAuto?'• Receita Hoje (Dashboard)':''}</small></div>${!isAuto && !String(e.id).startsWith('auto-') ? `<button data-del-fin="${e.id}" class="btn small danger">X</button>`:''}</div>`;
   }).join('')||'<p style="color:#666">Nenhum lançamento hoje</p>';
 }else{
   $('#listaFinanceiro').classList.add('hidden');
 }
 window._lastFinEntries = entries;
}
async function loadFinInterval(ini,fim){
 let q=sb.from('cash_entries').select('*').eq('slug',CURRENT_SLUG).order('entry_date').order('created_at');
 if(ini)q=q.gte('entry_date',ini);
 if(fim)q=q.lte('entry_date',fim);
 const {data:manualEntries=[]} = await q;
 let q2=sb.from('bookings').select('*,services(price)').eq('slug',CURRENT_SLUG).eq('paid',true).neq('status','cancelled').order('booking_date');
 if(ini)q2=q2.gte('booking_date',ini);
 if(fim)q2=q2.lte('booking_date',fim);
 const {data:booksPaid=[]} = await q2;
 const autoEntries = booksPaid.map(b=>{
   const jaExiste = manualEntries.find(m=>m.booking_id===b.id);
   if(jaExiste) return null;
   return { id:'auto-'+b.id, type:'income', amount:b.price||b.services?.price||0, entry_date:b.booking_date, category:'servico', payment_method:'auto', description:`Pagamentos no aplicativo - ${b.client_name} ${b.booking_date.split('-').reverse().join('/')} ${b.booking_time?.slice(0,5)}`, booking_id:b.id, is_auto:true, created_at:b.created_at };
 }).filter(Boolean);
 const allEntries = [...manualEntries, ...autoEntries].sort((a,b)=> new Date(a.entry_date) - new Date(b.entry_date));
 return allEntries;
}
function drawChart(entries){
 const canvas=$('#finChart');const wrap=$('#graficoWrap');if(!canvas||!wrap)return;
 if(!graficoVisivel){wrap.classList.add('hidden');return;}
 wrap.classList.remove('hidden');const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 const grouped={};entries.forEach(e=>{if(!grouped[e.entry_date])grouped[e.entry_date]={income:0,expense:0,count:0};grouped[e.entry_date][e.type]+=Number(e.amount||0);grouped[e.entry_date].count++;});
 const labels=Object.keys(grouped).sort();if(labels.length===0){ctx.fillStyle='#8a8fa3';ctx.fillText('Sem dados no intervalo',20,40);$('#graficoLegenda').textContent='Nenhum dado';return;}
 const incomes=labels.map(l=>grouped[l].income),expenses=labels.map(l=>grouped[l].expense);const max=Math.max(...incomes,...expenses,1);const w=canvas.width-60,h=canvas.height-60;
 ctx.fillStyle='#8a8fa3';ctx.font='11px sans-serif';ctx.fillText(`Receita (verde) vs Despesa (vermelho) - ${labels.length} dias | Máx: ${money(max)}`,10,15);
 labels.forEach((lb,i)=>{const x=30+(i*(w/labels.length));const barW=(w/labels.length)*0.35;const hi=(incomes[i]/max)*(h-30),he=(expenses[i]/max)*(h-30);
   ctx.fillStyle='#4ade80';ctx.fillRect(x,h-he+20,barW,hi);ctx.fillStyle='#f87171';ctx.fillRect(x+barW+4,h-he+20,barW,he);
   ctx.fillStyle='#fff';ctx.font='9px sans-serif';ctx.fillText(lb.slice(5),x, h+35);if(incomes[i]>0)ctx.fillText(money(incomes[i]),x, h-hi+15);if(expenses[i]>0)ctx.fillText(money(expenses[i]),x+barW+4, h-he+15);
 });
 $('#graficoLegenda').innerHTML=labels.map((l,i)=>`${l}: <span style="color:#4ade80">+${money(incomes[i])}</span> / <span style="color:#f87171">-${money(expenses[i])}</span>`).join(' • ');
}
document.addEventListener('click',async e=>{
 const t=e.target;
 if(t.id==='btnHamburger'){ $('#sidebar').classList.toggle('open'); $('#overlay').classList.toggle('show'); return; }
 if(t.id==='overlay'){ $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); return; }
 if(t.matches('[data-page]')){go(t.dataset.page);return;}
 if(t.id==='btnAdminLogin'){const email=$('#adminEmail').value.trim(),pass=$('#adminPass').value;const{error}=await sb.auth.signInWithPassword({email,password:pass});if(error)toast(error.message);return;}
 if(t.id==='btnLogoutAdmin'){await sb.auth.signOut();location.reload();return;}
 if(t.id==='btnAddServico'){const nome=$('#servNome').value.trim(),preco=Number($('#servPreco').value||0),dur=Number($('#servDuracao').value||30);if(!nome||!preco){toast('Nome e preço');return;}const{error}=await sb.from('services').insert({slug:CURRENT_SLUG,name:nome,price:preco,duration:dur,active:true});if(error)toast(error.message);else{toast('✅ Serviço adicionado');$('#servNome').value='';$('#servPreco').value='';loadServ();}return;}
 if(t.matches('[data-edit-serv]')){const{data:s}=await sb.from('services').select('*').eq('id',t.dataset.editServ).maybeSingle();editServId=s.id;$('#editServNome').value=s.name;$('#editServPreco').value=s.price;$('#editServDuracao').value=s.duration;$('#editServModal').classList.add('show');return;}
 if(t.id==='btnSaveEditServ'){await sb.from('services').update({name:$('#editServNome').value.trim(),price:Number($('#editServPreco').value||0),duration:Number($('#editServDuracao').value||0)}).eq('id',editServId);toast('Atualizado');$('#editServModal').classList.remove('show');loadServ();return;}
 if(t.matches('[data-del-serv]')){if(!confirm('Excluir?'))return;await sb.from('services').delete().eq('id',t.dataset.delServ);loadServ();return;}
 if(t.id==='btnAddCatalog'){
   let nome = ($('#newCatalogName').value||'').trim().toLowerCase();
   if(!nome){toast('Digite nome do produto');return;}
   nome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
   if(nome.length<2){toast('Nome muito curto');return;}
   const {data:catalog=[]} = await sb.from('product_catalog').select('name').eq('slug',CURRENT_SLUG);
   if(catalog.find(c=>c.name===nome)){toast(`⚠️ "${nome}" já existe no catálogo`);return;}
   const similar = catalog.find(c=>{ const a=c.name, b=nome; return a.length>3 && (a.includes(b) || b.includes(a)); });
   if(similar && !confirm(`Você digitou "${nome}" e já existe "${similar.name}" no catálogo. São produtos diferentes? OK para cadastrar, Cancelar para usar existente.`)){return;}
   const {error} = await sb.from('product_catalog').insert({slug:CURRENT_SLUG,name:nome});
   if(error){toast(error.message);return;}
   toast(`✅ "${nome}" salvo no catálogo (agora aparece na lista fixa)`);$('#newCatalogName').value='';loadEst();return;
 }
 if(t.id==='btnAddEstoque'){
   const nome=$('#estNome').value, qtd=Number($('#estQtd').value||0), min=Number($('#estMin').value||0), custo=Number($('#estCusto').value||0), cat=$('#estCat').value.trim();
   if(!nome){toast('Selecione produto do catálogo');return;}
   const {data:existe} = await sb.from('stock').select('*').eq('slug',CURRENT_SLUG).eq('name',nome).maybeSingle();
   if(existe){toast(`❌ "${nome}" já está no estoque com Qtd ${existe.quantity}. Use Editar.`);return;}
   const {error}=await sb.from('stock').insert({slug:CURRENT_SLUG,name:nome,quantity:qtd,min_quantity:min,cost:custo,category:cat});
   if(error){toast(error.message);return;}
   toast(`✅ "${nome}" adicionado ao estoque`);$('#estQtd').value='';loadEst();loadDash();return;
 }
 if(t.id==='btnToggleEstoque'){estoqueVisivel=!estoqueVisivel;loadEst();return;}
 if(t.id==='btnRetirar'){
   const prodId=$('#retiradaProduto').value,qtd=Number($('#retiradaQtd').value||0);
   if(!prodId||!qtd){toast('Selecione produto e quantidade');return;}
   const{data:item}=await sb.from('stock').select('*').eq('id',prodId).maybeSingle();
   if(!item){toast('Produto não encontrado');return;}
   if(qtd > Number(item.quantity||0)){
     alert(`❌ NÃO PODE RETIRAR ESSA QUANTIDADE\n\nProduto: ${item.name}\nQtd em estoque: ${item.quantity}\nTentou retirar: ${qtd}\n\nVocê está tentando retirar mais do que tem em estoque!`);
     return;
   }
   const novaQtd=Math.max(0,Number(item.quantity||0)-qtd);
   await sb.from('stock').update({quantity:novaQtd}).eq('id',prodId);
   toast(`✅ Retirado ${qtd} de ${item.name}. Qtd em estoque agora: ${novaQtd}`);
   if(novaQtd<=Number(item.min_quantity||0))toast(`⚠️ ALERTA: ${item.name} abaixo do mínimo`);
   $('#retiradaQtd').value='';$('#retiradaInfo').textContent='';loadEst();loadDash();return;
 }
 if(t.matches('[data-edit-est]')){const{data:i}=await sb.from('stock').select('*').eq('id',t.dataset.editEst).maybeSingle();editEstId=i.id;$('#editEstNome').value=i.name;$('#editEstQtd').value=i.quantity;$('#editEstMin').value=i.min_quantity;$('#editEstCusto').value=i.cost;$('#editEstCat').value=i.category||'';$('#editEstModal').classList.add('show');return;}
 if(t.id==='btnSaveEditEst'){await sb.from('stock').update({quantity:Number($('#editEstQtd').value||0),min_quantity:Number($('#editEstMin').value||0),cost:Number($('#editEstCusto').value||0),category:$('#editEstCat').value.trim()}).eq('id',editEstId);toast('Atualizado');$('#editEstModal').classList.remove('show');loadEst();loadDash();return;}
 if(t.matches('[data-del-est]')){if(!confirm('Excluir?'))return;await sb.from('stock').delete().eq('id',t.dataset.delEst);loadEst();return;}
 if(t.id==='btnAddFunc'){const nome=$('#funcNome').value.trim(),phone=$('#funcPhone').value.trim(),funcao=$('#funcFuncao').value,inicio=$('#funcInicio').value,fim=$('#funcFim').value,email=$('#funcEmail').value.trim();if(!nome||!phone){toast('Nome e telefone');return;}const{error}=await sb.from('professionals').insert({slug:CURRENT_SLUG,name:nome,phone,email:email||null,perfil:funcao,start_time:inicio,end_time:fim,active:true});if(error){toast(error.message);return;}toast('✅ Funcionário cadastrado');$('#funcNome').value='';$('#funcPhone').value='';loadFunc();await loadAgenda();return;}
 if(t.matches('[data-edit-func]')){const{data:f}=await sb.from('professionals').select('*').eq('id',t.dataset.editFunc).maybeSingle();editFuncId=f.id;$('#editFuncNome').value=f.name;$('#editFuncPhone').value=f.phone||'';$('#editFuncFuncao').value=f.perfil||'barbeiro';$('#editFuncInicio').value=f.start_time||'08:00';$('#editFuncFim').value=f.end_time||'18:00';$('#editFuncEmail').value=f.email||'';$('#editFuncModal').classList.add('show');return;}
 if(t.id==='btnSaveEditFunc'){await sb.from('professionals').update({name:$('#editFuncNome').value.trim(),phone:$('#editFuncPhone').value.trim(),perfil:$('#editFuncFuncao').value,start_time:$('#editFuncInicio').value,end_time:$('#editFuncFim').value,email:$('#editFuncEmail').value.trim()||null}).eq('id',editFuncId);toast('Atualizado');$('#editFuncModal').classList.remove('show');loadFunc();return;}
 if(t.matches('[data-del-func]')){if(!confirm('Excluir?'))return;await sb.from('professionals').delete().eq('id',t.dataset.delFunc);loadFunc();return;}
 if(t.id==='btnAgendarCliente'){
  const data=$('#agData').value,barbId=$('#agFuncionario').value,servId=$('#agServico').value,cliente=$('#agClienteNome').value.trim(),phone=$('#agClientePhone').value.trim(),obs=$('#agObs').value.trim();
  if(!data||!selectedHora||!cliente||!barbId){toast('Selecione data, horário, barbeiro e nome');return;}
  const{data:conflito}=await sb.from('bookings').select('id').eq('slug',CURRENT_SLUG).eq('booking_date',data).eq('booking_time',selectedHora).eq('professional_id',barbId).neq('status','cancelled').maybeSingle();
  if(conflito){toast('❌ Horário já ocupado para este barbeiro');return;}
  const{data:serv}=await sb.from('services').select('*').eq('id',servId).maybeSingle();
  const{data:{user:au}}=await sb.auth.getUser();
  const payload={slug:CURRENT_SLUG,booking_date:data,booking_time:selectedHora,service_id:servId,professional_id:barbId,client_name:cliente,phone,notes:obs,status:'confirmed',price:serv?.price||0,paid:false,user_id:au?.id||null};
  const{error}=await sb.from('bookings').insert(payload);if(error){toast('Erro agenda: '+error.message);return;}
  toast('✅ Agendado para '+cliente+' às '+selectedHora);$('#agClienteNome').value='';$('#agClientePhone').value='';$('#agObs').value='';selectedHora=null;await gerarHorariosDisponiveis();await listarAgendaDia();await loadDash();return;
 }
 if(t.matches('[data-cancel-book]')){const id=t.dataset.cancelBook;if(!confirm('Cancelar?'))return;await sb.from('bookings').update({status:'cancelled'}).eq('id',id);toast('Cancelado');await listarAgendaDia();await loadDash();return;}
 if(t.matches('[data-toggle-paid]')){
   const id=t.dataset.togglePaid;
   const{data:bk}=await sb.from('bookings').select('*').eq('id',id).maybeSingle();
   const novo=!bk.paid;
   await sb.from('bookings').update({paid:novo}).eq('id',id);
   if(novo){
     await sb.from('cash_entries').insert({slug:CURRENT_SLUG,type:'income',amount:bk.price||0,entry_date:bk.booking_date,category:'servico',payment_method:'pix',description:`Pagamento - ${bk.client_name}`,booking_id:bk.id});
     toast('✅ Pago - entrou no financeiro e receita hoje');
   }else{
     await sb.from('cash_entries').delete().eq('booking_id',id);
     toast('Desmarcado como pago');
   }
   await loadDash();await listarAgendaDia();await loadFin();return;
 }
 if(t.matches('[data-edit-book]')){const{data:bk}=await sb.from('bookings').select('*').eq('id',t.dataset.editBook).maybeSingle();editBookingId=bk.id;$('#editBookData').value=bk.booking_date;$('#editBookHora').value=(bk.booking_time||'').slice(0,5);$('#editBookCliente').value=bk.client_name||'';$('#editBookPhone').value=bk.phone||'';$('#editBookObs').value=bk.notes||'';const{data:funcs}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG);$('#editBookFunc').innerHTML=funcs.map(f=>`<option value="${f.id}" ${f.id===bk.professional_id?'selected':''}>${esc(f.name)}</option>`).join('');const{data:servs}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG);$('#editBookServ').innerHTML=servs.map(s=>`<option value="${s.id}" ${s.id===bk.service_id?'selected':''}>${esc(s.name)}</option>`).join('');$('#editBookingModal').classList.add('show');return;}
 if(t.id==='btnSaveEditBook'){await sb.from('bookings').update({booking_date:$('#editBookData').value,booking_time:$('#editBookHora').value,client_name:$('#editBookCliente').value.trim(),phone:$('#editBookPhone').value.trim(),notes:$('#editBookObs').value.trim(),professional_id:$('#editBookFunc').value,service_id:$('#editBookServ').value}).eq('id',editBookingId);toast('Atualizado');$('#editBookingModal').classList.remove('show');await listarAgendaDia();await loadDash();return;}
 if(t.id==='btnLancarManualTop'){ $('#formLancarManual').classList.toggle('hidden'); return; }
 if(t.id==='btnAddFinanceiro'){
   const tipo=$('#finTipo').value,valor=Number($('#finValor').value||0),data=$('#finData').value||today(),cat=$('#finCategoria').value,forma=$('#finForma').value,desc=$('#finDesc').value.trim();
   if(!valor){toast('Valor');return;}
   let {error} = await sb.from('cash_entries').insert({slug:CURRENT_SLUG,type:tipo,amount:valor,entry_date:data,category:cat,payment_method:forma,description:desc});
   if(error && error.message.includes('category')){ const r2 = await sb.from('cash_entries').insert({slug:CURRENT_SLUG,type:tipo,amount:valor,entry_date:data,payment_method:forma,description:desc}); error = r2.error; }
   if(error){toast('Erro: '+error.message);return;}
   toast('✅ Lançamento manual salvo - agora soma com Pagamentos no aplicativo');
   $('#finValor').value='';
   loadFin();
   return;
 }
 if(t.matches('[data-del-fin]')){
   if(!confirm('Excluir lançamento manual?'))return;
   await sb.from('cash_entries').delete().eq('id',t.dataset.delFin);
   toast('Excluído');
   loadFin();
   return;
 }
 if(t.id==='btnFiltrarFin'){
   const ini=$('#finInicio').value,fim=$('#finFim').value;
   if(!ini||!fim){toast('Selecione intervalo');return;}
   const entries = await loadFinInterval(ini,fim);
   renderFin(entries,false);
   if(graficoVisivel) drawChart(entries);
   toast(`Filtrado ${entries.length} lançamentos (Manual + Pagamentos no app)`);
   return;
 }
 if(t.id==='btnToggleFin'){financeiroVisivel=!financeiroVisivel;loadFin();return;}
 if(t.id==='btnLimparFin'){const hoje=today();$('#finInicio').value=hoje;$('#finFim').value=hoje;graficoVisivel=false;$('#graficoWrap').classList.add('hidden');loadFin();return;}
 if(t.id==='btnGraficoFin'){
   graficoVisivel=!graficoVisivel;
   if(!graficoVisivel){$('#graficoWrap').classList.add('hidden');toast('Gráfico oculto');return;}
   const ini=$('#finInicio').value,fim=$('#finFim').value;
   const entries = await loadFinInterval(ini,fim);
   renderFin(entries);
   drawChart(entries);
   return;
 }
 if(t.id==='btnFiltrarAgenda'){const ini=$('#filtroInicio').value,fim=$('#filtroFim').value;if(!ini||!fim){toast('Selecione intervalo');return;}const{data:bs}=await sb.from('bookings').select('*,services(name)').eq('slug',CURRENT_SLUG).gte('booking_date',ini).lte('booking_date',fim).order('booking_date').order('booking_time');$('#filtroResultado').innerHTML=bs.length?bs.map(b=>`<div class="list-row"><div><b>${b.booking_date.split('-').reverse().join('/')} ${(b.booking_time||'').slice(0,5)}</b> - ${esc(b.client_name||'')} - ${esc(b.phone||'')} - ${esc(b.services?.name||'')}<small style="display:block">${b.paid?'✅ Pago':'⏳ Não pago'} - ${esc(b.status)}</small></div><div style="display:flex;gap:6px"><button data-edit-book="${b.id}" class="btn small">Editar</button><button data-toggle-paid="${b.id}" class="btn small ${b.paid?'':'gold'}">${b.paid?'Desmarcar':'Pagar'}</button><button data-cancel-book="${b.id}" class="btn small danger">Cancelar</button></div></div>`).join(''):'<p style="color:#666">Nenhum no intervalo</p>';return;}
 if(t.id==='saveSettings'){const file=$('#setLogoFile').files[0];let logoUrl=$('#setLogoUrl').value.trim()||'dnh-logo.png';if(file){const ext=file.name.split('.').pop().toLowerCase();if(!['png','jpg','jpeg'].includes(ext)){toast('❌ Só PNG ou JPEG');return;}const fileName=`${CURRENT_SLUG}-${Date.now()}.${ext}`;const{error:upErr}=await sb.storage.from('logos').upload(fileName,file,{upsert:true});if(upErr){toast('Erro upload: '+upErr.message);return;}const{data:pub}=sb.storage.from('logos').getPublicUrl(fileName);logoUrl=pub.publicUrl;}const weekly={};document.querySelectorAll('[data-weekday]').forEach(row=>{const d=row.dataset.weekday;const en=row.querySelector('[data-week-enabled]');const st=row.querySelector('[data-week-start]');const enT=row.querySelector('[data-week-end]');weekly[d]={enabled:en?en.checked:true,start:st?st.value:'08:00',end:enT?enT.value:'18:00'};});const payload={slug:CURRENT_SLUG,name:$('#setName').value||'DNH',whatsapp:$('#setWhatsapp').value||'',start_time:($('#setStart').value||'08:00')+':00',end_time:($('#setEnd').value||'18:00')+':00',slot_interval:Number($('#setInterval').value||30),logo_url:logoUrl,lunch_start:($('#setLunchStart').value||'12:00')+':00',lunch_end:($('#setLunchEnd').value||'13:00')+':00',weekly_schedule:weekly};const{data:exists}=await sb.from('settings').select('slug').eq('slug',CURRENT_SLUG).maybeSingle();let err=null;if(exists){const r=await sb.from('settings').update(payload).eq('slug',CURRENT_SLUG);err=r.error;}else{const r=await sb.from('settings').insert(payload);err=r.error;}if(err){toast('Erro: '+err.message);return;}settings={...settings,...payload};applyLogo(logoUrl);toast('✅ Salvo - logo aplicada em todas as telas');$('#setLogoUrl').value=logoUrl;if($('#logoPreview')){$('#logoPreview').src=logoUrl;$('#logoPreview').style.display='block';}return;}
 if(t.dataset.closeModal){$('#'+t.dataset.closeModal).classList.remove('show');return;}
});
$('#agData')?.addEventListener('change',()=>{selectedHora=null;gerarHorariosDisponiveis();listarAgendaDia();});
$('#agFuncionario')?.addEventListener('change',()=>{selectedHora=null;gerarHorariosDisponiveis();});
$('#retiradaProduto')?.addEventListener('change', e=>{
  const opt=e.target.selectedOptions[0];
  const qtd=opt?.dataset?.qtd;
  $('#retiradaInfo').textContent=qtd!==undefined?`Qtd em estoque: ${qtd}`:'';
});
$('#setLogoFile')?.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const ext=file.name.split('.').pop().toLowerCase();if(!['png','jpg','jpeg'].includes(ext)){toast('Só PNG/JPEG');e.target.value='';return;}const reader=new FileReader();reader.onload=ev=>{const img=$('#logoPreview');img.src=ev.target.result;img.style.display='block';};reader.readAsDataURL(file);});
async function initAdmin(){await loadPublicLogo();sb.auth.onAuthStateChange(async(ev,sess)=>{if(sess){const{data:{user:au}}=await sb.auth.getUser();if(!au)return;const{data:prof}=await sb.from('profiles').select('*').eq('id',au.id).maybeSingle();if(!prof||prof.role!=='admin'){toast('Apenas admin');return;}profile=prof;$('#authAdmin').classList.add('hidden');$('#appAdmin').classList.remove('hidden');$('#adminEmailDisplay').textContent=prof.email;await loadSet();$('#barberName').textContent=settings.name||CURRENT_SLUG;loadDash();}else{$('#authAdmin').classList.remove('hidden');$('#appAdmin').classList.add('hidden');}});const{data:{session}}=await sb.auth.getSession();if(session){const{data:{user:au}}=await sb.auth.getUser();if(au){const{data:prof}=await sb.from('profiles').select('*').eq('id',au.id).maybeSingle();if(prof){profile=prof;$('#authAdmin').classList.add('hidden');$('#appAdmin').classList.remove('hidden');$('#adminEmailDisplay').textContent=prof.email;await loadSet();$('#barberName').textContent=settings.name||CURRENT_SLUG;loadDash();}}}}
initAdmin();
