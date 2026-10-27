let sb=null, currentSlug='dnh', currentShop=null, currentAdmin=null;
let editingServId=null, editingEstId=null, editingFuncId=null, editingBookId=null, editingMovId=null, editingClienteId=null;
let selectedHora='', estoqueVisible=true, finVisible=false;
let cacheFuncionarios=[], cacheServicos=[], cacheClientes=[], schemaCache={};
function $id(id){return document.getElementById(id);}
function toast(m){let t=$id('toast'); if(!t){t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t);} t.textContent=m; t.classList.add('show'); setTimeout(function(){t.classList.remove('show');},3000);}
function fmtMoney(v){return 'R$ '+Number(v||0).toFixed(2).replace('.',',');}
function getSlug(){const p=location.pathname.split('/').filter(Boolean); if(p.length>=2) return p[0]; if(p.length===1 && p[0].indexOf('.html')===-1) return p[0]; return localStorage.getItem('dnh_slug')||'dnh';}
function openModal(id){let e=$id(id); if(e) e.classList.add('show');}
function closeModal(id){let e=$id(id); if(e) e.classList.remove('show');}
function cleanPhone(p){return String(p||'').replace(/[^0-9]/g,'');}
function capFirst(s){ s=String(s||'').trim().toLowerCase(); if(!s) return s; return s.charAt(0).toUpperCase()+s.slice(1); }
function rowDate(r){ return r.booking_date||r.date||r.appointment_date||r.scheduled_date||(r.created_at?String(r.created_at).slice(0,10):''); }
function movDate(m){ return m.date||m.movement_date||m.created_at? (m.date||m.movement_date||String(m.created_at||'').slice(0,10)) : ''; }
function finDate(f){ return f.date||f.entry_date||f.transaction_date||(f.created_at?String(f.created_at).slice(0,10):''); }
async function getCols(table){
  if(schemaCache[table]) return schemaCache[table];
  try{ let r=await sb.from(table).select('*').limit(1); if(r.data && r.data.length>0){ schemaCache[table]=Object.keys(r.data[0]); return schemaCache[table]; } }catch(e){}
  let fallback={bookings:['id','slug','booking_date','date','time','customer_name','name','phone','service_id','professional_id','employee_id','employee_name','professional_name','price','status','payment_status','obs','notes','created_at'],services:['id','slug','name','price','duration','duration_minutes'],inventory:['id','slug','name','product_name','quantity','current_quantity','min_quantity','min_stock','cost','unit_cost','category'],professionals:['id','slug','name','phone','email','role','funcao','start_time','end_time','commission_percent','commission','commission_type'],cash_entries:['id','slug','type','amount','value','date','entry_date','created_at','category','payment_method','form','description'],barbershops:['id','slug','name','whatsapp','phone','logo_url','start_time','end_time','interval_minutes','lunch_start','lunch_end','working_days','working_hours','opening_hours','schedule'],customers:['id','slug','name','phone','birthdate'],product_catalog:['id','slug','name'],inventory_movements:['id','slug','product','product_name','type','quantity','cost','unit_cost','date','movement_date','supplier','reason','motivo','obs','created_at'],professional_payments:['id','slug','professional_id','employee_id','employee_name','professional_name','start_date','end_date','total','commission','amount','paid_at','status']};
  schemaCache[table]=fallback[table]||[]; return schemaCache[table];
}
function filterObj(obj, cols){ let o={}; Object.keys(obj).forEach(function(k){ if(cols.indexOf(k)!==-1) o[k]=obj[k]; }); return o; }
document.addEventListener('DOMContentLoaded', async function(){
  currentSlug=getSlug(); localStorage.setItem('dnh_slug',currentSlug);
  if($id('slugDisplay')) $id('slugDisplay').textContent=currentSlug;
  if($id('barberSlug')) $id('barberSlug').textContent=currentSlug;
  try{ if(window.supabase && window.DNH_CONFIG){ sb=window.supabase.createClient(window.DNH_CONFIG.supabaseUrl, window.DNH_CONFIG.supabaseAnonKey); window.sb=sb; } }catch(e){ console.log(e); }
  if(sb){ const res=await sb.from('barbershops').select('*').eq('slug',currentSlug).single(); if(res.data){ currentShop=res.data; if($id('barberName')) $id('barberName').textContent=(res.data.name||'BARBEARIA').toUpperCase(); if($id('shopNameLogin')) $id('shopNameLogin').textContent=(res.data.name||'BARBEARIA').toUpperCase(); if(res.data.logo_url){ ['logoSidebar','logoLogin'].forEach(function(i){let el=$id(i); if(el) el.src=res.data.logo_url;}); } } }
  document.querySelectorAll('[data-close-modal]').forEach(function(b){ b.addEventListener('click', function(){ closeModal(b.dataset.closeModal); }); });
  document.querySelectorAll('.nav button').forEach(function(btn){ btn.addEventListener('click', function(){ document.querySelectorAll('.nav button').forEach(function(x){x.classList.remove('active');}); btn.classList.add('active'); document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');}); let pg=$id('page-'+btn.dataset.page); if(pg) pg.classList.add('active'); let s=$id('sidebar'); if(s) s.classList.remove('open'); let o=$id('overlay'); if(o) o.classList.remove('show'); if(btn.dataset.page==='clientes') carregarAniversariantes(); if(btn.dataset.page==='dashboard') carregarDashboard(); }); });
  if($id('btnHamburger')) $id('btnHamburger').addEventListener('click', function(){ $id('sidebar').classList.toggle('open'); $id('overlay').classList.toggle('show'); });
  if($id('overlay')) $id('overlay').addEventListener('click', function(){ $id('sidebar').classList.remove('open'); $id('overlay').classList.remove('show'); });
  if($id('btnAdminLogin')) $id('btnAdminLogin').addEventListener('click', loginAdmin);
  if($id('adminPass')) $id('adminPass').addEventListener('keydown', function(e){ if(e.key==='Enter') loginAdmin(); });
  if($id('btnLogoutAdmin')) $id('btnLogoutAdmin').addEventListener('click', function(){ localStorage.removeItem('dnh_admin'); location.reload(); });
  let saved=localStorage.getItem('dnh_admin'); if(saved){ try{ currentAdmin=JSON.parse(saved); }catch(e){} }
  if(currentAdmin){ mostrarApp(); } else { let a=$id('authAdmin'); if(a) a.classList.add('ready'); let l=$id('appLoader'); if(l) l.classList.add('hidden'); }
  bindEvents();
});
async function loginAdmin(){
  let email=$id('adminEmail').value.trim(), pass=$id('adminPass').value;
  if(!email||!pass) return toast('Preencha e-mail e senha');
  if(!sb) return toast('Erro Supabase - confira config.js');
  let res=await sb.auth.signInWithPassword({email:email,password:pass});
  if(res.error) return toast('Login invalido: '+res.error.message);
  currentAdmin={email:email,id:res.data.user.id}; localStorage.setItem('dnh_admin',JSON.stringify(currentAdmin));
  if($id('adminEmailDisplay')) $id('adminEmailDisplay').textContent=email;
  mostrarApp();
}
function mostrarApp(){ let a=$id('authAdmin'); if(a) a.style.display='none'; let ap=$id('appAdmin'); if(ap) ap.classList.remove('hidden'); let l=$id('appLoader'); if(l) l.classList.add('hidden'); if(currentAdmin && $id('adminEmailDisplay')) $id('adminEmailDisplay').textContent=currentAdmin.email; carregarTudo(); }
async function carregarTudo(){ await carregarDashboard(); await carregarAgendaAdmin(); await carregarServicos(); await carregarEstoque(); await carregarFuncionarios(); await carregarFinanceiro(); await carregarSettings(); await carregarAniversariantes(); await carregarCatalogoSelects(); }
function bindEvents(){
  if($id('btnFiltrarAgenda')) $id('btnFiltrarAgenda').addEventListener('click', filtrarDashboard);
  if($id('btnAgendarCliente')) $id('btnAgendarCliente').addEventListener('click', agendarCliente);
  if($id('btnAddServico')) $id('btnAddServico').addEventListener('click', addServico);
  if($id('btnSaveEditServ')) $id('btnSaveEditServ').addEventListener('click', salvarEditServ);
  if($id('btnAddCatalog')) $id('btnAddCatalog').addEventListener('click', addCatalog);
  if($id('btnAddEntrada')) $id('btnAddEntrada').addEventListener('click', addEntrada);
  if($id('btnRetirar')) $id('btnRetirar').addEventListener('click', retirarEstoque);
  if($id('btnToggleEstoque')) $id('btnToggleEstoque').addEventListener('click', function(){ estoqueVisible=!estoqueVisible; if($id('listaEstoque')) $id('listaEstoque').style.display=estoqueVisible?'block':'none'; });
  if($id('btnFiltrarEst')) $id('btnFiltrarEst').addEventListener('click', carregarMovimentos);
  if($id('btnLimparEst')) $id('btnLimparEst').addEventListener('click', function(){ if($id('estFiltroInicio')) $id('estFiltroInicio').value=''; if($id('estFiltroFim')) $id('estFiltroFim').value=''; if($id('estFiltroProduto')) $id('estFiltroProduto').value=''; carregarMovimentos(); });
  if($id('btnSaveEditEst')) $id('btnSaveEditEst').addEventListener('click', salvarEditEst);
  if($id('btnSaveEditMov')) $id('btnSaveEditMov').addEventListener('click', salvarEditMov);
  if($id('btnAddFunc')) $id('btnAddFunc').addEventListener('click', addFunc);
  if($id('btnSaveEditFunc')) $id('btnSaveEditFunc').addEventListener('click', salvarEditFunc);
  if($id('comPeriodo')) $id('comPeriodo').addEventListener('change', function(e){ if($id('comCustomBox')) $id('comCustomBox').style.display=e.target.value==='custom'?'grid':'none'; if(e.target.value!=='custom') calcularComissao(); });
  if($id('btnCalcularCom')) $id('btnCalcularCom').addEventListener('click', calcularComissao);
  if($id('btnPagarComissao')) $id('btnPagarComissao').addEventListener('click', pagarComissao);
  if($id('btnLancarManualTop')) $id('btnLancarManualTop').addEventListener('click', function(){ let f=$id('formLancarManual'); if(f) f.classList.toggle('hidden'); });
  if($id('btnAddFinanceiro')) $id('btnAddFinanceiro').addEventListener('click', addFinanceiro);
  if($id('btnFiltrarFin')) $id('btnFiltrarFin').addEventListener('click', carregarFinanceiro);
  if($id('btnToggleFin')) $id('btnToggleFin').addEventListener('click', function(){ finVisible=!finVisible; let l=$id('listaFinanceiro'); if(l) l.classList.toggle('hidden',!finVisible); });
  if($id('btnLimparFin')) $id('btnLimparFin').addEventListener('click', function(){ if($id('finInicio')) $id('finInicio').value=''; if($id('finFim')) $id('finFim').value=''; carregarFinanceiro(); });
  if($id('btnGraficoFin')) $id('btnGraficoFin').addEventListener('click', function(){ let g=$id('graficoWrap'); if(g) g.classList.toggle('hidden'); desenharGrafico(); });
  if($id('saveSettings')) $id('saveSettings').addEventListener('click', salvarSettings);
  if($id('btnSaveEditBook')) $id('btnSaveEditBook').addEventListener('click', salvarEditBook);
  if($id('agData')) $id('agData').addEventListener('change', carregarHorarios);
  if($id('agFuncionario')) $id('agFuncionario').addEventListener('change', carregarHorarios);
  if($id('agServico')) $id('agServico').addEventListener('change', carregarHorarios);
  if($id('retiradaProduto')) $id('retiradaProduto').addEventListener('change', atualizarRetiradaInfo);
  if($id('buscaCliente')) $id('buscaCliente').addEventListener('input', carregarAniversariantes);
  if($id('agClienteNome')) $id('agClienteNome').addEventListener('input', onNomeClienteChange);
  if($id('agClienteNome')) $id('agClienteNome').addEventListener('change', onNomeClienteChange);
  if($id('btnFiltrarAgendaLista')) $id('btnFiltrarAgendaLista').addEventListener('click', carregarAgendaAdmin);
  if($id('btnLimparAgendaLista')) $id('btnLimparAgendaLista').addEventListener('click', function(){ if($id('agFiltroInicio')) $id('agFiltroInicio').value=''; if($id('agFiltroFim')) $id('agFiltroFim').value=''; if($id('agFiltroFunc')) $id('agFiltroFunc').value=''; carregarAgendaAdmin(); });
  if($id('estFiltroInicio')) $id('estFiltroInicio').addEventListener('change', carregarMovimentos);
  if($id('estFiltroFim')) $id('estFiltroFim').addEventListener('change', carregarMovimentos);
  if($id('estFiltroProduto')) $id('estFiltroProduto').addEventListener('change', carregarMovimentos);
  if($id('finInicio')) $id('finInicio').addEventListener('change', carregarFinanceiro);
  if($id('finFim')) $id('finFim').addEventListener('change', carregarFinanceiro);
  let hoje=new Date().toISOString().slice(0,10);
  if($id('agData')) $id('agData').value=hoje;
  if($id('estEntradaData')) $id('estEntradaData').value=hoje;
  if($id('retiradaData')) $id('retiradaData').value=hoje;
  if($id('finData')) $id('finData').value=hoje;
}
function onNomeClienteChange(){ let nome=$id('agClienteNome').value.trim().toLowerCase(); let found=cacheClientes.find(function(c){ return String(c.name||'').trim().toLowerCase()===nome; }); if(found && $id('agClientePhone')) $id('agClientePhone').value=found.phone||''; }
async function fetchAllBookings(){
  let r=await sb.from('bookings').select('*, services(name,price)').eq('slug',currentSlug).order('created_at',{ascending:false}).limit(1000);
  if(r.error){ r=await sb.from('bookings').select('*').eq('slug',currentSlug).limit(1000); }
  return r.data||[];
}
async function carregarDashboard(){
  if(!sb) return;
  let hoje=new Date().toISOString().slice(0,10);
  if($id('dashDate')) $id('dashDate').textContent=new Date().toLocaleDateString('pt-BR');
  let bookings=await fetchAllBookings();
  let hojeList=bookings.filter(function(b){ return rowDate(b)===hoje; });
  let pagos=hojeList.filter(function(b){ return b.status==='paid'||b.payment_status==='paid'; });
  let receita=0; pagos.forEach(function(b){ receita+=Number(b.price||(b.services&&b.services.price)||0); });
  if($id('dashHoje')) $id('dashHoje').textContent=hojeList.length;
  if($id('dashClientes')) $id('dashClientes').textContent=new Set(hojeList.map(function(b){return b.phone;})).size;
  if($id('dashReceita')) $id('dashReceita').textContent=fmtMoney(receita);
  if($id('dashTicket')) $id('dashTicket').textContent=fmtMoney(hojeList.length?receita/hojeList.length:0);
  if($id('todayAgenda')){
    if(hojeList.length===0){ $id('todayAgenda').innerHTML='Nenhum atendimento hoje'; }
    else { let h=''; hojeList.forEach(function(b){ h+='<div class="list-row"><div><b>'+(b.time||'')+' - '+(b.customer_name||b.name||'')+'</b><br><small>'+((b.services&&b.services.name)||'')+' - '+(b.employee_name||b.professional_name||'')+'</small></div><span>'+(b.status||'')+'</span></div>'; }); $id('todayAgenda').innerHTML=h; }
  }
  let re=await sb.from('inventory').select('*').eq('slug',currentSlug);
  let estoque=re.data||[];
  let baixo=estoque.filter(function(e){ return Number(e.quantity||e.current_quantity||0) <= Number(e.min_quantity||e.min_stock||5); });
  if($id('dashEstoque')){
    if(baixo.length===0) $id('dashEstoque').innerHTML='Estoque OK';
    else { let h2=''; baixo.forEach(function(e){ h2+='<div>Alerta '+(e.name||e.product_name)+' - '+(e.quantity||e.current_quantity)+' restantes</div>'; }); $id('dashEstoque').innerHTML=h2; }
  }
  carregarAniversariantes();
}
async function filtrarDashboard(){
  let ini=$id('filtroInicio')? $id('filtroInicio').value : '';
  let fim=$id('filtroFim')? $id('filtroFim').value : '';
  if(!ini||!fim) return toast('Escolha inicio e fim');
  let all=await fetchAllBookings();
  let fil=all.filter(function(b){ let d=rowDate(b); return d>=ini && d<=fim; });
  let rec=0; fil.forEach(function(b){ if(b.status==='paid'||b.payment_status==='paid') rec+=Number(b.price||0); });
  if($id('filtroResultado')) $id('filtroResultado').innerHTML='<b>'+fil.length+'</b> atendimentos - Receita: <b>'+fmtMoney(rec)+'</b> - '+ini+' ate '+fim;
  if($id('filtroLista')){
    if(fil.length===0) $id('filtroLista').innerHTML='Nenhum atendimento no periodo';
    else { let h=''; fil.forEach(function(b){ h+='<div class="list-row"><div><b>'+rowDate(b)+' '+(b.time||'')+' - '+(b.customer_name||b.name)+'</b><br><small>'+(b.phone||'')+' - '+(b.employee_name||b.professional_name||'')+' - '+fmtMoney(b.price||0)+'</small></div><span>'+(b.status||'')+'</span></div>'; }); $id('filtroLista').innerHTML=h; }
  }
}
async function carregarAgendaAdmin(){
  if(!sb) return;
  let rc=await sb.from('customers').select('*').eq('slug',currentSlug).order('name');
  cacheClientes=rc.data||[];
  let dl=$id('listaClientesAgenda'); if(dl){ let h=''; cacheClientes.forEach(function(c){ h+='<option value="'+c.name+'">'; }); dl.innerHTML=h; }
  let rf=await sb.from('professionals').select('*').eq('slug',currentSlug);
  cacheFuncionarios=rf.data||[];
  let rs=await sb.from('services').select('*').eq('slug',currentSlug);
  cacheServicos=rs.data||[];
  if($id('agFuncionario')){ if(cacheFuncionarios.length===0) $id('agFuncionario').innerHTML='<option value="">Cadastre um barbeiro em Funcionarios</option>'; else { let h=''; cacheFuncionarios.forEach(function(f){ h+='<option value="'+f.id+'">'+f.name+'</option>'; }); $id('agFuncionario').innerHTML=h; } }
  if($id('agServico')){ if(cacheServicos.length===0) $id('agServico').innerHTML='<option value="">Cadastre um servico</option>'; else { let h=''; cacheServicos.forEach(function(s){ h+='<option value="'+s.id+'">'+s.name+' - '+fmtMoney(s.price)+'</option>'; }); $id('agServico').innerHTML=h; } }
  if($id('editBookFunc')){ let h=''; cacheFuncionarios.forEach(function(f){ h+='<option value="'+f.id+'">'+f.name+'</option>'; }); $id('editBookFunc').innerHTML=h; }
  if($id('editBookServ')){ let h=''; cacheServicos.forEach(function(s){ h+='<option value="'+s.id+'">'+s.name+'</option>'; }); $id('editBookServ').innerHTML=h; }
  if($id('agFiltroFunc')){ let cur=$id('agFiltroFunc').value; let h='<option value="">Todos barbeiros</option>'; cacheFuncionarios.forEach(function(f){ h+='<option value="'+f.id+'">'+f.name+'</option>'; }); $id('agFiltroFunc').innerHTML=h; if(cur) $id('agFiltroFunc').value=cur; }
  await carregarHorarios();
  let all=await fetchAllBookings();
  let fIni=$id('agFiltroInicio')? $id('agFiltroInicio').value : '';
  let fFim=$id('agFiltroFim')? $id('agFiltroFim').value : '';
  let fFunc=$id('agFiltroFunc')? $id('agFiltroFunc').value : '';
  let bookings=all.filter(function(b){ let d=rowDate(b); if(fIni && d<fIni) return false; if(fFim && d>fFim) return false; if(fFunc && String(b.professional_id)!==String(fFunc) && String(b.employee_id)!==String(fFunc)) return false; return true; });
  bookings.sort(function(a,b){ return rowDate(b).localeCompare(rowDate(a)); });
  if($id('adminAgendaList')){
    if(bookings.length===0){ $id('adminAgendaList').innerHTML='Sem agendamentos'; }
    else { let h=''; bookings.forEach(function(b){ h+='<div class="list-row"><div><b>'+rowDate(b)+' '+(b.time||'')+' - '+(b.customer_name||b.name)+'</b><br><small>'+((b.services&&b.services.name)||'')+' - '+(b.phone||'')+' - '+(b.status||'')+' - '+(b.employee_name||b.professional_name||'')+'</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-pago="'+b.id+'">Pago</button><button class="btn small" data-edit-book="'+b.id+'">Editar</button><button class="btn small danger" data-del-book="'+b.id+'">Excluir</button></div></div>'; }); $id('adminAgendaList').innerHTML=h; $id('adminAgendaList').querySelectorAll('[data-pago]').forEach(function(x){ x.addEventListener('click', function(){ marcarPago(x.dataset.pago); }); }); $id('adminAgendaList').querySelectorAll('[data-edit-book]').forEach(function(x){ x.addEventListener('click', function(){ editarBooking(x.dataset.editBook); }); }); $id('adminAgendaList').querySelectorAll('[data-del-book]').forEach(function(x){ x.addEventListener('click', function(){ excluirBooking(x.dataset.delBook); }); }); }
  }
}
async function carregarHorarios(){
  if(!sb) return;
  let data=$id('agData')? $id('agData').value : '';
  let funcId=$id('agFuncionario')? $id('agFuncionario').value : '';
  if(!data) return;
  let all=await fetchAllBookings();
  let ocupados=new Set();
  all.forEach(function(b){ if(rowDate(b)===data && (String(b.professional_id)===String(funcId)||String(b.employee_id)===String(funcId)) && b.status!=='cancelled') ocupados.add(b.time); });
  let horarios=[]; let start=8*60, end=18*60, interval=Number((currentShop&&currentShop.interval_minutes)||30);
  if(currentShop && currentShop.start_time){ let p=String(currentShop.start_time).split(':'); start=parseInt(p[0])*60+parseInt(p[1]||0); }
  if(currentShop && currentShop.end_time){ let p=String(currentShop.end_time).split(':'); end=parseInt(p[0])*60+parseInt(p[1]||0); }
  let sched=window._daySchedule||null;
  if(sched && data){ let dow=new Date(data+'T12:00:00').getDay(); let ds=sched[dow]; if(ds && ds.active){ let a=String(ds.start).split(':'); let bb=String(ds.end).split(':'); start=parseInt(a[0])*60+parseInt(a[1]||0); end=parseInt(bb[0])*60+parseInt(bb[1]||0); } }
  for(let m=start;m<end;m+=interval){ let hh=String(Math.floor(m/60)); if(hh.length<2) hh='0'+hh; let mm=String(m%60); if(mm.length<2) mm='0'+mm; horarios.push(hh+':'+mm); }
  if($id('agHoraGrid')){
    let h=''; horarios.forEach(function(hr){ let occ=ocupados.has(hr); let bg=occ?'#2a1515':'#0a0e1a'; let col=occ?'#666':'#fff'; let cur=occ?'not-allowed':'pointer'; if(selectedHora===hr){ bg='var(--gold)'; col='#000'; } h+='<button type="button" '+(occ?'disabled':'')+' data-hora="'+hr+'" style="padding:10px;border-radius:8px;border:1px solid var(--border);background:'+bg+';color:'+col+';cursor:'+cur+'">'+hr+'</button>'; });
    $id('agHoraGrid').innerHTML=h;
    $id('agHoraGrid').querySelectorAll('[data-hora]').forEach(function(b){ b.addEventListener('click', function(){ selectedHora=b.dataset.hora; $id('agHoraGrid').querySelectorAll('button').forEach(function(x){ x.style.background='#0a0e1a'; x.style.color='#fff'; }); b.style.background='var(--gold)'; b.style.color='#000'; }); });
  }
}
async function agendarCliente(){
  let date=$id('agData').value, professional_id=$id('agFuncionario').value, service_id=$id('agServico').value;
  let name=$id('agClienteNome').value.trim(), phone=$id('agClientePhone').value.trim(), obs=$id('agObs').value.trim();
  if(!date||!service_id||!name||!phone||!selectedHora) return toast('Preencha tudo e escolha horario');
  let serv=cacheServicos.find(function(s){ return String(s.id)===String(service_id); })||{};
  let func=cacheFuncionarios.find(function(f){ return String(f.id)===String(professional_id); })||{};
  let cols=await getCols('bookings');
  let raw={slug:currentSlug,booking_date:date,date:date,appointment_date:date,scheduled_date:date,time:selectedHora,professional_id:professional_id||null,employee_id:professional_id||null,employee_name:func.name||'',professional_name:func.name||'',service_id:service_id,customer_name:name,name:name,phone:phone,obs:obs,notes:obs,price:serv.price||0,status:'pending'};
  let payload=filterObj(raw, cols);
  let res=await sb.from('bookings').insert([payload]);
  if(res.error) return toast('Erro: '+res.error.message);
  let ccols=await getCols('customers');
  let existing=cacheClientes.find(function(c){ return String(c.name||'').trim().toLowerCase()===name.toLowerCase() && cleanPhone(c.phone)===cleanPhone(phone); });
  if(!existing){ let cp=filterObj({slug:currentSlug,name:name,phone:phone}, ccols); let cr=await sb.from('customers').upsert(cp,{onConflict:'slug,phone'}); if(cr.error){ await sb.from('customers').insert([cp]); } }
  toast('Agendado!'); selectedHora=''; $id('agClienteNome').value=''; $id('agClientePhone').value=''; $id('agObs').value='';
  carregarDashboard(); carregarAgendaAdmin();
}
async function marcarPago(id){ await sb.from('bookings').update({status:'paid',payment_status:'paid'}).eq('id',id); toast('Marcado como pago'); carregarDashboard(); carregarAgendaAdmin(); carregarFinanceiro(); }
async function excluirBooking(id){ if(!confirm('Excluir agendamento?')) return; await sb.from('bookings').delete().eq('id',id); carregarDashboard(); carregarAgendaAdmin(); }
async function editarBooking(id){ editingBookId=id; let r=await sb.from('bookings').select('*').eq('id',id).single(); let b=r.data; if(!b) return; $id('editBookData').value=rowDate(b); $id('editBookHora').value=b.time; $id('editBookCliente').value=b.customer_name||b.name||''; $id('editBookPhone').value=b.phone||''; $id('editBookObs').value=b.obs||b.notes||''; $id('editBookFunc').value=b.professional_id||b.employee_id||''; $id('editBookServ').value=b.service_id||''; openModal('editBookingModal'); }
async function salvarEditBook(){ let cols=await getCols('bookings'); let d=$id('editBookData').value; let raw={booking_date:d,date:d,appointment_date:d,scheduled_date:d,time:$id('editBookHora').value,customer_name:$id('editBookCliente').value,name:$id('editBookCliente').value,phone:$id('editBookPhone').value,obs:$id('editBookObs').value,professional_id:$id('editBookFunc').value,employee_id:$id('editBookFunc').value,service_id:$id('editBookServ').value}; let payload=filterObj(raw, cols); let res=await sb.from('bookings').update(payload).eq('id',editingBookId); if(res.error) return toast(res.error.message); closeModal('editBookingModal'); toast('Salvo'); carregarAgendaAdmin(); carregarDashboard(); }
async function carregarServicos(){
  if(!sb) return;
  let r=await sb.from('services').select('*').eq('slug',currentSlug).order('name');
  if(r.error) return toast(r.error.message);
  cacheServicos=r.data||[];
  if($id('listaServicos')){
    if(cacheServicos.length===0){ $id('listaServicos').innerHTML='Sem servicos'; }
    else { let h=''; cacheServicos.forEach(function(s){ h+='<div class="list-row"><div><b>'+s.name+'</b><br><small>'+fmtMoney(s.price)+' - '+(s.duration||s.duration_minutes||30)+' min</small></div><div style="display:flex;gap:6px"><button class="btn small" data-edit-serv="'+s.id+'">Editar</button><button class="btn small danger" data-del-serv="'+s.id+'">Excluir</button></div></div>'; }); $id('listaServicos').innerHTML=h; $id('listaServicos').querySelectorAll('[data-edit-serv]').forEach(function(b){ b.addEventListener('click', function(){ let s=cacheServicos.find(function(x){ return String(x.id)===b.dataset.editServ; }); if(s){ editingServId=s.id; $id('editServNome').value=s.name; $id('editServPreco').value=s.price; $id('editServDuracao').value=s.duration||s.duration_minutes||30; openModal('editServModal'); } }); }); $id('listaServicos').querySelectorAll('[data-del-serv]').forEach(function(b){ b.addEventListener('click', function(){ excluirServ(b.dataset.delServ); }); }); }
  }
}
async function addServico(){
  let name=$id('servNome').value.trim(); let price=parseFloat($id('servPreco').value); let dur=parseInt($id('servDuracao').value)||30;
  if(!name||!price) return toast('Preencha nome e preco');
  let cols=await getCols('services');
  let payload=filterObj({slug:currentSlug,name:name,price:price,duration:dur,duration_minutes:dur}, cols);
  let res=await sb.from('services').insert([payload]);
  if(res.error) return toast('Erro ao salvar: '+res.error.message);
  toast('Servico adicionado'); $id('servNome').value=''; $id('servPreco').value=''; carregarServicos(); carregarAgendaAdmin();
}
async function salvarEditServ(){ let cols=await getCols('services'); let payload=filterObj({name:$id('editServNome').value,price:parseFloat($id('editServPreco').value),duration:parseInt($id('editServDuracao').value),duration_minutes:parseInt($id('editServDuracao').value)}, cols); let res=await sb.from('services').update(payload).eq('id',editingServId); if(res.error) return toast(res.error.message); closeModal('editServModal'); toast('Salvo'); carregarServicos(); }
async function excluirServ(id){ if(!confirm('Excluir servico?')) return; let res=await sb.from('services').delete().eq('id',id); if(res.error) return toast(res.error.message); toast('Excluido'); carregarServicos(); }
async function carregarCatalogoSelects(){
  if(!sb) return;
  let r=await sb.from('product_catalog').select('*').eq('slug',currentSlug).order('name');
  if(r.error){ console.log(r.error); return toast('Catalogo: '+r.error.message); }
  let data=r.data||[];
  let opts=''; data.forEach(function(c){ opts+='<option value="'+c.name+'">'+c.name+'</option>'; });
  if($id('estEntradaProduto')) $id('estEntradaProduto').innerHTML=opts||'<option value="">Cadastre um produto no catalogo</option>';
  if($id('retiradaProduto')) $id('retiradaProduto').innerHTML=opts||'<option value="">Cadastre um produto</option>';
  if($id('estFiltroProduto')) $id('estFiltroProduto').innerHTML='<option value="">Todos produtos</option>'+opts;
}
async function addCatalog(){
  let raw=$id('newCatalogName').value.trim();
  if(!raw) return toast('Digite o nome');
  let name=capFirst(raw);
  let r=await sb.from('product_catalog').select('*').eq('slug',currentSlug).ilike('name',name);
  if(r.data && r.data.length>0){ alert('Ja existe o produto: '+name); return; }
  let cols=await getCols('product_catalog');
  let payload=filterObj({slug:currentSlug,name:name}, cols);
  let res=await sb.from('product_catalog').insert([payload]);
  if(res.error){ if(String(res.error.message).indexOf('duplicate')!==-1 || String(res.error.message).indexOf('unique')!==-1){ alert('Ja existe o produto: '+name); return; } return toast('Erro catalogo: '+res.error.message); }
  $id('newCatalogName').value=''; alert('Salvo com sucesso: '+name); toast('Salvo no catalogo'); carregarCatalogoSelects();
}
async function carregarEstoque(){
  if(!sb) return;
  let r=await sb.from('inventory').select('*').eq('slug',currentSlug).order('name');
  if(r.error) return toast('Estoque: '+r.error.message);
  let data=r.data||[];
  if($id('listaEstoque')){
    if(data.length===0){ $id('listaEstoque').innerHTML='Estoque vazio'; }
    else { let h=''; data.forEach(function(e){ let qtd=e.quantity; if(qtd==null) qtd=e.current_quantity; if(qtd==null) qtd=0; let min=e.min_quantity; if(min==null) min=e.min_stock; if(min==null) min=5; let custo=e.cost; if(custo==null) custo=e.unit_cost; if(custo==null) custo=0; let cls=Number(qtd)<=Number(min)?'estoque-alerta':''; h+='<div class="list-row '+cls+'"><div><b>'+(e.name||e.product_name)+'</b><br><small>Qtd: '+qtd+' - Min: '+min+' - Custo: '+fmtMoney(custo)+'</small></div><button class="btn small" data-edit-est="'+e.id+'">Editar</button></div>'; }); $id('listaEstoque').innerHTML=h; $id('listaEstoque').querySelectorAll('[data-edit-est]').forEach(function(b){ b.addEventListener('click', function(){ let e=data.find(function(x){ return String(x.id)===b.dataset.editEst; }); if(e){ editingEstId=e.id; $id('editEstNome').value=e.name||e.product_name; $id('editEstQtd').value=e.quantity!=null?e.quantity:e.current_quantity||0; $id('editEstMin').value=e.min_quantity!=null?e.min_quantity:e.min_stock||5; $id('editEstCusto').value=e.cost!=null?e.cost:e.unit_cost||0; $id('editEstCat').value=e.category||''; openModal('editEstModal'); } }); }); }
  }
  carregarMovimentos();
}
async function addEntrada(){
  let produto=$id('estEntradaProduto').value; let qtd=parseFloat($id('estEntradaQtd').value); let custo=parseFloat($id('estEntradaCusto').value)||0; let dataCompra=$id('estEntradaData').value; let forn=$id('estEntradaForn').value;
  if(!produto||!qtd||!dataCompra) return toast('Preencha produto, qtd e data');
  let icols=await getCols('inventory');
  let ra=await sb.from('inventory').select('*').eq('slug',currentSlug).eq('name',produto).single();
  let atual=ra.data;
  if(atual){ let base=atual.quantity; if(base==null) base=atual.current_quantity; if(base==null) base=0; let novaQtd=Number(base)+qtd; let payload=filterObj({quantity:novaQtd,current_quantity:novaQtd,cost:custo||atual.cost,unit_cost:custo||atual.unit_cost}, icols); let res=await sb.from('inventory').update(payload).eq('id',atual.id); if(res.error) return toast(res.error.message); }
  else { let payload=filterObj({slug:currentSlug,name:produto,product_name:produto,quantity:qtd,current_quantity:qtd,min_quantity:5,min_stock:5,cost:custo,unit_cost:custo,category:''}, icols); let res2=await sb.from('inventory').insert([payload]); if(res2.error) return toast(res2.error.message); }
  let mcols=await getCols('inventory_movements');
  let mp=filterObj({slug:currentSlug,product:produto,product_name:produto,type:'entrada',quantity:qtd,cost:custo,unit_cost:custo,date:dataCompra,movement_date:dataCompra,supplier:forn,obs:forn}, mcols);
  await sb.from('inventory_movements').insert([mp]);
  toast('Compra registrada'); carregarEstoque(); $id('estEntradaQtd').value='';
}
async function atualizarRetiradaInfo(){ let prod=$id('retiradaProduto').value; let r=await sb.from('inventory').select('*').eq('slug',currentSlug).eq('name',prod).single(); let d=r.data; if($id('retiradaInfo')) $id('retiradaInfo').textContent=d?('Saldo atual: '+(d.quantity!=null?d.quantity:d.current_quantity)):''; }
async function retirarEstoque(){
  let produto=$id('retiradaProduto').value; let qtd=parseFloat($id('retiradaQtd').value); let dataUso=$id('retiradaData').value; let motivo=$id('retiradaMotivo').value;
  if(!produto||!qtd||!dataUso) return toast('Preencha tudo');
  let ra=await sb.from('inventory').select('*').eq('slug',currentSlug).eq('name',produto).single();
  let atual=ra.data;
  if(!atual) return toast('Produto sem saldo');
  let saldo=atual.quantity; if(saldo==null) saldo=atual.current_quantity; if(saldo==null) saldo=0;
  if(Number(saldo)<qtd) return toast('Saldo insuficiente');
  let novaQtd=Number(saldo)-qtd;
  let icols=await getCols('inventory');
  await sb.from('inventory').update(filterObj({quantity:novaQtd,current_quantity:novaQtd}, icols)).eq('id',atual.id);
  let mcols=await getCols('inventory_movements');
  await sb.from('inventory_movements').insert([filterObj({slug:currentSlug,product:produto,product_name:produto,type:'saida',quantity:qtd,date:dataUso,movement_date:dataUso,reason:motivo,motivo:motivo,obs:motivo}, mcols)]);
  toast('Saida registrada'); carregarEstoque(); $id('retiradaQtd').value='';
}
async function salvarEditEst(){ let icols=await getCols('inventory'); let payload=filterObj({quantity:parseFloat($id('editEstQtd').value),current_quantity:parseFloat($id('editEstQtd').value),min_quantity:parseFloat($id('editEstMin').value),min_stock:parseFloat($id('editEstMin').value),cost:parseFloat($id('editEstCusto').value),unit_cost:parseFloat($id('editEstCusto').value),category:$id('editEstCat').value}, icols); let res=await sb.from('inventory').update(payload).eq('id',editingEstId); if(res.error) return toast(res.error.message); closeModal('editEstModal'); toast('Salvo'); carregarEstoque(); }
async function carregarMovimentos(){
  if(!sb) return;
  let r=await sb.from('inventory_movements').select('*').eq('slug',currentSlug).order('created_at',{ascending:false}).limit(500);
  let data=r.data||[];
  let ini=$id('estFiltroInicio')? $id('estFiltroInicio').value : '';
  let fim=$id('estFiltroFim')? $id('estFiltroFim').value : '';
  let prod=$id('estFiltroProduto')? $id('estFiltroProduto').value : '';
  data=data.filter(function(m){ let d=movDate(m); if(ini && d<ini) return false; if(fim && d>fim) return false; if(prod && (m.product||m.product_name)!==prod) return false; return true; });
  data.sort(function(a,b){ return movDate(b).localeCompare(movDate(a)); });
  if($id('listaMovimentos')){
    if(data.length===0){ $id('listaMovimentos').innerHTML='Sem movimentos - ajuste o filtro'; }
    else { let h=''; data.forEach(function(m){ let custo=m.cost!=null?m.cost:m.unit_cost||0; h+='<div class="list-row"><div><b>'+(m.type==='entrada'?'Entrada':'Saida')+' '+(m.product||m.product_name)+' - Qtd: '+m.quantity+'</b><br><small>Data: '+movDate(m)+' - Custo unitario: '+fmtMoney(custo)+' - Total: '+fmtMoney(Number(m.quantity||0)*Number(custo||0))+' - '+(m.supplier||m.reason||m.obs||'')+'</small></div><button class="btn small" data-edit-mov="'+m.id+'">Editar</button></div>'; }); $id('listaMovimentos').innerHTML=h; $id('listaMovimentos').querySelectorAll('[data-edit-mov]').forEach(function(b){ b.addEventListener('click', function(){ let m=data.find(function(x){ return String(x.id)===b.dataset.editMov; }); if(m){ editingMovId=m.id; $id('editMovProduto').value=m.product||m.product_name; $id('editMovTipo').value=m.type; $id('editMovQtd').value=m.quantity; $id('editMovData').value=movDate(m); $id('editMovCusto').value=m.cost!=null?m.cost:m.unit_cost||0; $id('editMovObs').value=m.supplier||m.reason||''; openModal('editMovModal'); } }); }); }
  }
}
async function salvarEditMov(){ let mcols=await getCols('inventory_movements'); let payload=filterObj({type:$id('editMovTipo').value,quantity:parseFloat($id('editMovQtd').value),date:$id('editMovData').value,movement_date:$id('editMovData').value,cost:parseFloat($id('editMovCusto').value),unit_cost:parseFloat($id('editMovCusto').value),supplier:$id('editMovObs').value,obs:$id('editMovObs').value}, mcols); let res=await sb.from('inventory_movements').update(payload).eq('id',editingMovId); if(res.error) return toast(res.error.message); closeModal('editMovModal'); toast('Movimentacao atualizada'); carregarEstoque(); }
async function carregarFuncionarios(){
  if(!sb) return;
  let r=await sb.from('professionals').select('*').eq('slug',currentSlug).order('name');
  if(r.error) return toast('Funcionarios: '+r.error.message);
  cacheFuncionarios=r.data||[];
  if($id('listaFuncionarios')){
    if(cacheFuncionarios.length===0){ $id('listaFuncionarios').innerHTML='Sem funcionarios'; }
    else { let h=''; cacheFuncionarios.forEach(function(f){ h+='<div class="list-row"><div><b>'+f.name+'</b><br><small>'+(f.phone||'')+' - '+(f.role||f.funcao||'barbeiro')+' - '+(f.commission_percent||f.commission||50)+(f.commission_type==='fixed'?' R fixo':'%')+'</small></div><div style="display:flex;gap:6px"><button class="btn small" data-edit-func="'+f.id+'">Editar</button><button class="btn small danger" data-del-func="'+f.id+'">Excluir</button></div></div>'; }); $id('listaFuncionarios').innerHTML=h; $id('listaFuncionarios').querySelectorAll('[data-edit-func]').forEach(function(b){ b.addEventListener('click', function(){ let f=cacheFuncionarios.find(function(x){ return String(x.id)===b.dataset.editFunc; }); if(f){ editingFuncId=f.id; $id('editFuncNome').value=f.name; $id('editFuncPhone').value=f.phone||''; $id('editFuncFuncao').value=f.role||f.funcao||'barbeiro'; $id('editFuncInicio').value=f.start_time||'08:00'; $id('editFuncFim').value=f.end_time||'18:00'; $id('editFuncComissao').value=f.commission_percent||f.commission||50; $id('editFuncComissaoTipo').value=f.commission_type||'percent'; $id('editFuncEmail').value=f.email||''; openModal('editFuncModal'); } }); }); $id('listaFuncionarios').querySelectorAll('[data-del-func]').forEach(function(b){ b.addEventListener('click', function(){ excluirFunc(b.dataset.delFunc); }); }); }
  }
  if($id('comBarbeiro')){ if(cacheFuncionarios.length===0) $id('comBarbeiro').innerHTML='<option value="">Sem barbeiros - cadastre em Funcionarios</option>'; else { let h=''; cacheFuncionarios.forEach(function(f){ h+='<option value="'+f.id+'">'+f.name+'</option>'; }); $id('comBarbeiro').innerHTML=h; } }
}
async function addFunc(){
  let name=$id('funcNome').value.trim(), phone=$id('funcPhone').value.trim();
  if(!name||!phone) return toast('Preencha nome e telefone');
  let cols=await getCols('professionals');
  let payload=filterObj({slug:currentSlug,name:name,phone:phone,role:$id('funcFuncao').value,funcao:$id('funcFuncao').value,start_time:$id('funcInicio').value,end_time:$id('funcFim').value,email:$id('funcEmail').value,commission_percent:parseFloat($id('funcComissao').value)||50,commission:parseFloat($id('funcComissao').value)||50,commission_type:$id('funcComissaoTipo').value}, cols);
  let res=await sb.from('professionals').insert([payload]);
  if(res.error) return toast('Erro ao cadastrar: '+res.error.message);
  toast('Funcionario cadastrado'); $id('funcNome').value=''; $id('funcPhone').value=''; carregarFuncionarios(); carregarAgendaAdmin();
}
async function salvarEditFunc(){ let cols=await getCols('professionals'); let payload=filterObj({name:$id('editFuncNome').value,phone:$id('editFuncPhone').value,role:$id('editFuncFuncao').value,funcao:$id('editFuncFuncao').value,start_time:$id('editFuncInicio').value,end_time:$id('editFuncFim').value,commission_percent:parseFloat($id('editFuncComissao').value),commission:parseFloat($id('editFuncComissao').value),commission_type:$id('editFuncComissaoTipo').value,email:$id('editFuncEmail').value}, cols); let res=await sb.from('professionals').update(payload).eq('id',editingFuncId); if(res.error) return toast(res.error.message); closeModal('editFuncModal'); toast('Salvo'); carregarFuncionarios(); }
async function excluirFunc(id){ if(!confirm('Excluir funcionario?')) return; let res=await sb.from('professionals').delete().eq('id',id); if(res.error) return toast(res.error.message); toast('Excluido'); carregarFuncionarios(); }
function getPeriodo(){ let p=$id('comPeriodo').value; let hoje=new Date(); let ini='', fim=hoje.toISOString().slice(0,10); if(p==='hoje'){ ini=fim; } else if(p==='semana'){ let d=new Date(hoje); d.setDate(hoje.getDate()-7); ini=d.toISOString().slice(0,10); } else if(p==='quinzena'){ let d=new Date(hoje); d.setDate(hoje.getDate()-15); ini=d.toISOString().slice(0,10); } else if(p==='mes'){ ini=hoje.toISOString().slice(0,7)+'-01'; } else { ini=$id('comInicio').value; fim=$id('comFim').value; } return {ini:ini,fim:fim}; }
let comissaoAtual=null;
async function calcularComissao(){
  if(!sb) return; let barbeiroId=$id('comBarbeiro').value; let per=getPeriodo(); let ini=per.ini, fim=per.fim; if(!barbeiroId||!ini||!fim) return toast('Escolha barbeiro e periodo');
  let func=cacheFuncionarios.find(function(f){ return String(f.id)===String(barbeiroId); })||{};
  if(!func.id){ let rf=await sb.from('professionals').select('*').eq('slug',currentSlug); cacheFuncionarios=rf.data||[]; func=cacheFuncionarios.find(function(f){ return String(f.id)===String(barbeiroId); })||{}; }
  let all=await fetchAllBookings();
  let filtrados=all.filter(function(b){ let d=rowDate(b); if(d<ini||d>fim) return false; let isPaid=(b.status==='paid'||b.payment_status==='paid'); if(!isPaid) return false; let byId=String(b.professional_id)===String(barbeiroId)||String(b.employee_id)===String(barbeiroId); let byName=(b.employee_name||b.professional_name)===(func.name||''); return byId||byName; });
  let total=0; filtrados.forEach(function(b){ total+=Number(b.price||(b.services&&b.services.price)||0); });
  let comissao=0; let perc=Number(func.commission_percent||func.commission||50);
  if(func.commission_type==='fixed') comissao=filtrados.length*perc; else comissao=total*(perc/100);
  comissaoAtual={professional_id:barbeiroId,employee_name:func.name,professional_name:func.name,ini:ini,fim:fim,total:total,comissao:comissao,qtd:filtrados.length};
  if($id('comResumo')) $id('comResumo').innerHTML='<div class="grid-3"><div class="metric-card"><small>ATENDIMENTOS PAGOS</small><b>'+filtrados.length+'</b></div><div class="metric-card"><small>FATURAMENTO</small><b>'+fmtMoney(total)+'</b></div><div class="metric-card"><small>COMISSAO ('+(func.commission_type==='fixed'?'R$ '+perc+' por atendimento':perc+'%')+')</small><b style="color:var(--gold)">'+fmtMoney(comissao)+'</b></div></div>';
  let pagos=await sb.from('professional_payments').select('*').eq('slug',currentSlug);
  let pagosList=(pagos.data||[]).filter(function(p){ return String(p.professional_id)===String(barbeiroId)||String(p.employee_id)===String(barbeiroId)||(p.professional_name||p.employee_name)===(func.name||''); });
  if($id('listaComissoes')){
    if(filtrados.length===0) $id('listaComissoes').innerHTML='Sem atendimentos pagos no periodo - marque o agendamento como Pago na Agenda ou na tela do Barbeiro';
    else { let h=''; filtrados.forEach(function(b){ let d=rowDate(b); let isPago=pagosList.some(function(p){ return String(p.start_date)<=d && String(p.end_date)>=d; }); let badge=isPago?'<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:99px;font-size:11px">Pago</span>':'<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:99px;font-size:11px">Nao pago</span>'; h+='<div class="list-row"><div><b>'+d+' '+(b.time||'')+' - '+(b.customer_name||b.name)+'</b><br><small>'+fmtMoney(b.price||0)+' - '+(b.employee_name||b.professional_name||'')+'</small></div>'+badge+'</div>'; }); $id('listaComissoes').innerHTML=h; }
  }
  let bp=$id('btnPagarComissao'); if(bp) bp.style.display='block';
  carregarPagamentos();
}
async function pagarComissao(){ if(!comissaoAtual) return; let cols=await getCols('professional_payments'); let payload=filterObj({slug:currentSlug,professional_id:comissaoAtual.professional_id,employee_id:comissaoAtual.professional_id,employee_name:comissaoAtual.employee_name,professional_name:comissaoAtual.employee_name,start_date:comissaoAtual.ini,end_date:comissaoAtual.fim,total:comissaoAtual.total,commission:comissaoAtual.comissao,amount:comissaoAtual.comissao,paid_at:new Date().toISOString(),status:'paid'}, cols); let res=await sb.from('professional_payments').insert([payload]); if(res.error) return toast(res.error.message); toast('Comissao marcada como paga'); carregarPagamentos(); calcularComissao(); }
async function carregarPagamentos(){ let r=await sb.from('professional_payments').select('*').eq('slug',currentSlug).order('paid_at',{ascending:false}).limit(20); let data=r.data||[]; if($id('listaPagamentos')){ if(data.length===0) $id('listaPagamentos').innerHTML='Nenhum pagamento ainda'; else { let h=''; data.forEach(function(p){ let st=(p.status==='paid'||p.paid_at)?'Pago':'Nao pago'; let bg=st==='Pago'?'#16a34a':'#dc2626'; h+='<div class="list-row"><div><b>'+(p.professional_name||p.employee_name)+' - '+fmtMoney(p.commission||p.amount)+'</b><br><small>'+p.start_date+' ate '+p.end_date+'</small></div><span style="background:'+bg+';color:#fff;padding:2px 8px;border-radius:99px;font-size:11px">'+st+'</span></div>'; }); $id('listaPagamentos').innerHTML=h; } } }
async function carregarFinanceiro(){
  if(!sb) return;
  let r=await sb.from('cash_entries').select('*').eq('slug',currentSlug).order('created_at',{ascending:false}).limit(500);
  if(r.error) return toast('Financeiro: '+r.error.message);
  let data=r.data||[];
  let ini=$id('finInicio')? $id('finInicio').value : ''; let fim=$id('finFim')? $id('finFim').value : '';
  data=data.filter(function(f){ let d=finDate(f); if(ini && d<ini) return false; if(fim && d>fim) return false; return true; });
  let allBooks=await fetchAllBookings();
  let paidBooks=allBooks.filter(function(b){ if(b.status!=='paid' && b.payment_status!=='paid') return false; let d=rowDate(b); if(ini && d<ini) return false; if(fim && d>fim) return false; return true; });
  paidBooks.forEach(function(b){ let d=rowDate(b); let exists=data.some(function(f){ return String(f.description||'').indexOf(String(b.id).slice(0,8))!==-1; }); if(!exists) data.unshift({id:'book-'+b.id,type:'income',amount:Number(b.price||0),value:Number(b.price||0),date:d,created_at:b.created_at,category:'Agendamento',payment_method:'',description:'Agendamento '+(b.customer_name||b.name)+' '+(b.time||'')}); });
  let ent=0, sai=0; data.forEach(function(f){ if(f.type==='income') ent+=Number(f.amount||f.value||0); else sai+=Number(f.amount||f.value||0); });
  if($id('finResumo')) $id('finResumo').innerHTML='<div class="metric-card"><small>ENTRADAS</small><b style="color:#4ade80">'+fmtMoney(ent)+'</b></div><div class="metric-card"><small>SAIDAS</small><b style="color:#f87171">'+fmtMoney(sai)+'</b></div><div class="metric-card"><small>LUCRO</small><b style="color:var(--gold)">'+fmtMoney(ent-sai)+'</b></div>';
  if($id('listaFinanceiro')){
    if(data.length===0) $id('listaFinanceiro').innerHTML='Sem lancamentos no periodo';
    else { let h=''; data.forEach(function(f){ let d=finDate(f); h+='<div class="list-row"><div><b>'+(f.type==='income'?'Entrada':'Saida')+' '+(f.description||'')+' - '+fmtMoney(f.amount||f.value)+'</b><br><small>'+d+' - Categoria: '+(f.category||'Sem categoria')+' - '+(f.payment_method||f.form||'')+'</small></div>'+(String(f.id).indexOf('book-')===0?'':('<button class="btn small danger" data-del-fin="'+f.id+'">Excluir</button>'))+'</div>'; }); $id('listaFinanceiro').innerHTML=h; $id('listaFinanceiro').querySelectorAll('[data-del-fin]').forEach(function(b){ b.addEventListener('click', function(){ excluirFin(b.dataset.delFin); }); }); }
  }
  window._finData=data;
  let cats={}; data.forEach(function(f){ if(f.category) cats[f.category]=1; });
  let dl=$id('listaCategorias'); if(dl){ let h=''; Object.keys(cats).forEach(function(c){ h+='<option value="'+c+'">'; }); let base=['Corte','Barba','Produto','Aluguel','Compra estoque','Comissão','Outros']; base.forEach(function(c){ if(!cats[c]) h+='<option value="'+c+'">'; }); dl.innerHTML=h; }
}
async function addFinanceiro(){ let valor=parseFloat($id('finValor').value); let data=$id('finData').value||new Date().toISOString().slice(0,10); if(!valor) return toast('Preencha valor'); let cat=$id('finCategoria').value||'Outros'; let cols=await getCols('cash_entries'); let payload=filterObj({slug:currentSlug,type:$id('finTipo').value,amount:valor,value:valor,date:data,entry_date:data,created_at:data+'T12:00:00',category:cat,payment_method:$id('finForma').value,form:$id('finForma').value,description:$id('finDesc').value||cat}, cols); let res=await sb.from('cash_entries').insert([payload]); if(res.error) return toast(res.error.message); toast('Lancado - Categoria: '+cat); let f=$id('formLancarManual'); if(f) f.classList.add('hidden'); $id('finCategoria').value=''; $id('finValor').value=''; carregarFinanceiro(); }
async function excluirFin(id){ if(!confirm('Excluir lancamento?')) return; await sb.from('cash_entries').delete().eq('id',id); carregarFinanceiro(); }
function desenharGrafico(){ let canvas=$id('finChart'); if(!canvas) return; let ctx=canvas.getContext('2d'); let data=window._finData||[]; ctx.clearRect(0,0,canvas.width,canvas.height); let porDia={}; data.forEach(function(f){ let d=finDate(f); porDia[d]=(porDia[d]||0)+(f.type==='income'?Number(f.amount||f.value||0):-Number(f.amount||f.value||0)); }); let dias=Object.keys(porDia).sort().slice(-15); let max=1; dias.forEach(function(d){ let a=Math.abs(porDia[d]); if(a>max) max=a; }); ctx.font='12px Inter'; dias.forEach(function(d,i){ let h=Math.abs(porDia[d])/max*200; let x=20+i*50; let y=280-h; ctx.fillStyle=porDia[d]>=0?'#4ade80':'#f87171'; ctx.fillRect(x,y,30,h); ctx.fillStyle='#fff'; ctx.fillText(d.slice(5),x,300); }); if($id('graficoLegenda')) $id('graficoLegenda').textContent='Verde = lucro do dia, Vermelho = prejuizo'; }
function parseSchedule(){
  let sched={};
  if(currentShop){
    let raw=currentShop.working_hours||currentShop.opening_hours||currentShop.schedule||null;
    if(typeof raw==='string'){ try{ raw=JSON.parse(raw); }catch(e){ raw=null; } }
    if(raw && typeof raw==='object'){ Object.keys(raw).forEach(function(k){ sched[k]=raw[k]; }); return sched; }
    let days=currentShop.working_days||[0,1,2,3,4,5,6];
    for(let i=0;i<7;i++){ sched[i]={active:days.indexOf(i)!==-1,start:currentShop.start_time||'08:00',end:currentShop.end_time||'18:00'}; }
    return sched;
  }
  for(let i=0;i<7;i++){ sched[i]={active:true,start:'08:00',end:'18:00'}; }
  return sched;
}
async function carregarSettings(){
  let sched=parseSchedule(); window._daySchedule=sched;
  let diasNomes=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  if($id('weeklyBox')){
    let h='<label class="lbl">Dias de funcionamento - personalize cada dia</label>';
    diasNomes.forEach(function(d,i){ let s=sched[i]||{active:true,start:'08:00',end:'18:00'}; h+='<div class="dia-row"><input type="checkbox" class="dia-check" data-dia="'+i+'" '+(s.active?'checked':'')+'><b style="min-width:80px">'+d+'</b><label style="font-size:11px;color:var(--text)">Abre</label><input type="time" class="dia-start" data-dia="'+i+'" value="'+(s.start||'08:00')+'"><label style="font-size:11px;color:var(--text)">Fecha</label><input type="time" class="dia-end" data-dia="'+i+'" value="'+(s.end||'18:00')+'"></div>'; });
    h+='<small style="color:var(--text)">Desmarque o dia para fechar. O horário de cada dia vale para a Agenda.</small>';
    $id('weeklyBox').innerHTML=h;
  }
  if(!currentShop) return;
  if($id('setName')) $id('setName').value=currentShop.name||'';
  if($id('setWhatsapp')) $id('setWhatsapp').value=currentShop.whatsapp||currentShop.phone||'';
  if($id('setLogoUrl')) $id('setLogoUrl').value=currentShop.logo_url||'';
  if($id('setInterval')) $id('setInterval').value=currentShop.interval_minutes||30;
  if($id('setLunchStart')) $id('setLunchStart').value=currentShop.lunch_start||'12:00';
  if($id('setLunchEnd')) $id('setLunchEnd').value=currentShop.lunch_end||'13:00';
  if($id('logoPreview')&&currentShop.logo_url){ $id('logoPreview').src=currentShop.logo_url; $id('logoPreview').style.display='block'; }
}
async function salvarSettings(){
  let sched={}; let dias=[];
  document.querySelectorAll('.dia-check').forEach(function(c){ let i=parseInt(c.dataset.dia); let st=document.querySelector('.dia-start[data-dia="'+i+'"]').value; let en=document.querySelector('.dia-end[data-dia="'+i+'"]').value; sched[i]={active:c.checked,start:st,end:en}; if(c.checked) dias.push(i); });
  window._daySchedule=sched;
  let logoUrl=$id('setLogoUrl').value;
  let file=$id('setLogoFile').files[0];
  if(file && sb){
    try{ let path=currentSlug+'/'+Date.now()+'_'+file.name; let up=await sb.storage.from('logos').upload(path,file); if(!up.error){ let pub=sb.storage.from('logos').getPublicUrl(path); logoUrl=pub.data.publicUrl; } else { logoUrl=await new Promise(function(res){ let r=new FileReader(); r.onload=function(e){ res(e.target.result); }; r.readAsDataURL(file); }); toast('Logo salva local, vai aparecer'); } }catch(e){ console.log(e); }
  }
  let cols=await getCols('barbershops');
  let firstActive=null; for(let i=0;i<7;i++){ if(sched[i] && sched[i].active){ firstActive=sched[i]; break; } }
  let raw={name:$id('setName').value,whatsapp:$id('setWhatsapp').value,phone:$id('setWhatsapp').value,logo_url:logoUrl,start_time:firstActive?firstActive.start:'08:00',end_time:firstActive?firstActive.end:'18:00',interval_minutes:parseInt($id('setInterval').value)||30,lunch_start:$id('setLunchStart').value,lunch_end:$id('setLunchEnd').value,working_days:dias,working_hours:JSON.stringify(sched),opening_hours:JSON.stringify(sched),schedule:JSON.stringify(sched)};
  let payload=filterObj(raw, cols);
  let res=await sb.from('barbershops').update(payload).eq('slug',currentSlug);
  if(res.error) return toast('Erro ao salvar: '+res.error.message);
  toast('Salvo'); currentShop=Object.assign({},currentShop,payload);
  if(logoUrl && $id('logoPreview')){ $id('logoPreview').src=logoUrl; $id('logoPreview').style.display='block'; }
}
async function carregarAniversariantes(){
  try{
    let r=await sb.from('customers').select('*').eq('slug',currentSlug);
    if(r.error) return console.log(r.error);
    let clientes=r.data||[]; cacheClientes=clientes;
    let elTotal=$id('totalClientes'); if(elTotal) elTotal.textContent=clientes.length;
    let hoje=new Date(); let mesHoje=hoje.getMonth()+1; let diaHoje=hoje.getDate();
    let comNasc=clientes.filter(function(c){ return c.birthdate; });
    let doMes=comNasc.filter(function(c){ return (new Date(c.birthdate+'T12:00:00').getMonth()+1)===mesHoje; });
    let deHoje=doMes.filter(function(c){ return new Date(c.birthdate+'T12:00:00').getDate()===diaHoje; });
    doMes.sort(function(a,b){ return new Date(a.birthdate).getDate()-new Date(b.birthdate).getDate(); });
    let elMes=$id('totalAniversarioMes'); if(elMes) elMes.textContent=doMes.length;
    let elLista=$id('listaAniversarioMes');
    if(elLista){
      if(doMes.length===0) elLista.innerHTML='Nenhum aniversariante esse mes';
      else { let h=''; doMes.forEach(function(c){ let d=new Date(c.birthdate+'T12:00:00'); let ehHoje=d.getDate()===diaHoje?' <b style="color:var(--gold)">- HOJE</b>':''; let msg=encodeURIComponent('Fala '+c.name+'! Aqui e da Barbearia! Parabens pelo seu dia! Passa aqui essa semana que voce tem 20% DE DESCONTO DE ANIVERSARIANTE! Quer agendar?'); h+='<div class="list-row"><div><b>'+c.name+' - '+String(d.getDate())+'/'+String(d.getMonth()+1)+'</b><br><small>'+c.phone+'</small></div><a href="https://wa.me/55'+cleanPhone(c.phone)+'?text='+msg+'" target="_blank" style="color:#25D366">WhatsApp</a>'+ehHoje+'</div>'; }); elLista.innerHTML=h; }
    }
    if(deHoje.length>0){ let card=$id('cardAniversario'); if(card){ card.style.display='block'; let h1=''; deHoje.forEach(function(c){ h1+='Aniversario hoje: <b>'+c.name+'</b> - '+c.phone+'<br>'; }); if($id('listaAniversarioHoje')) $id('listaAniversarioHoje').innerHTML=h1; let hb=''; deHoje.forEach(function(c){ let msg=encodeURIComponent('Fala '+c.name+'! Parabens pelo seu dia! Hoje voce tem 20% DE DESCONTO DE ANIVERSARIANTE, quer aproveitar e agendar seu corte?'); hb+='<a href="https://wa.me/55'+cleanPhone(c.phone)+'?text='+msg+'" target="_blank" style="display:inline-block;margin:6px 6px 0 0;background:#25D366;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:700">WhatsApp '+c.name+'</a>'; }); if($id('botoesAniversarioHoje')) $id('botoesAniversarioHoje').innerHTML=hb; } } else { let card=$id('cardAniversario'); if(card) card.style.display='none'; }
    let lista=$id('listaClientes');
    if(lista){
      let filtro=($id('buscaCliente')? $id('buscaCliente').value : '').toLowerCase();
      let filtrados=clientes;
      if(filtro){ filtrados=clientes.filter(function(c){ return c.name.toLowerCase().indexOf(filtro)!==-1 || String(c.phone).indexOf(filtro)!==-1; }); }
      if(filtrados.length===0){ lista.innerHTML='Nenhum cliente ainda'; }
      else { let h=''; filtrados.forEach(function(c){ let nasc='-'; if(c.birthdate){ let d=new Date(c.birthdate+'T12:00:00'); nasc=String(d.getDate())+'/'+String(d.getMonth()+1)+'/'+d.getFullYear(); } h+='<div class="list-row"><div><b>'+c.name+'</b><br><small>'+c.phone+' - Nasc: '+nasc+'</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><a href="https://wa.me/55'+cleanPhone(c.phone)+'" target="_blank"><button class="btn small">WhatsApp</button></a><button class="btn small" data-edit-cli="'+c.id+'">Editar</button><button class="btn small danger" data-del-cli="'+c.id+'">Excluir</button></div></div>'; }); lista.innerHTML=h; lista.querySelectorAll('[data-edit-cli]').forEach(function(b){ b.addEventListener('click', function(){ let c=clientes.find(function(x){ return String(x.id)===b.dataset.editCli; }); if(!c) return; editingClienteId=c.id; let novoNome=prompt('Nome:',c.name); if(novoNome===null) return; let novoNasc=prompt('Data nascimento (AAAA-MM-DD):',c.birthdate||''); if(novoNasc===null) return; let novoPhone=prompt('Telefone:',c.phone); if(novoPhone===null) return; salvarClienteEdit(novoNome,novoNasc,novoPhone); }); }); lista.querySelectorAll('[data-del-cli]').forEach(function(b){ b.addEventListener('click', function(){ excluirCliente(b.dataset.delCli); }); }); }
    }
  }catch(e){ console.log(e); }
}
async function salvarClienteEdit(nome,nasc,phone){ let res=await sb.from('customers').update({name:nome,birthdate:nasc||null,phone:phone}).eq('id',editingClienteId); if(res.error) return toast(res.error.message); toast('Cliente atualizado'); carregarAniversariantes(); }
async function excluirCliente(id){ if(!confirm('Excluir cliente?')) return; await sb.from('customers').delete().eq('id',id); carregarAniversariantes(); }
