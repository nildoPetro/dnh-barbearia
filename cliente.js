const cfg=window.DNH_CONFIG||{};const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let CURRENT_SLUG=new URLSearchParams(window.location.search).get('b')||localStorage.getItem('dnh_slug')||'dnh';
let settings={},selectedHora=null,currentUser=null,barbeiros=[];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(m){let el=document.createElement('div');el.className='toast';el.textContent=m;document.body.appendChild(el);setTimeout(()=>el.classList.add('show'),10);setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300)},3500);}
function showMenu(){ $('#menuCliente').classList.remove('hidden'); $('#pageAgendar').classList.add('hidden'); $('#pageConsultar').classList.add('hidden'); }
async function loadSettingsCliente(){
 let data=null;try{const r=await sb.from('settings').select('*').eq('slug',CURRENT_SLUG).maybeSingle();if(r.data)data=r.data;}catch(e){}
 if(data){settings={...settings,...data};$('#shopName').textContent=data.name||CURRENT_SLUG.toUpperCase();$('#shopSlug').textContent=CURRENT_SLUG;}
}
async function loadBarbeirosEServicos(){
 const{data:funcs=[]}=await sb.from('professionals').select('*').eq('slug',CURRENT_SLUG).eq('active',true);
 barbeiros=funcs;
 const sel=$('#cliBarbeiro');
 if(funcs.length===0){sel.innerHTML='<option value="">Dono da barbearia</option>';$('#barbeiroHint').textContent='Barbearia com atendimento único';selectedBarbeiroAuto=funcs[0]?.id||null;}
 else if(funcs.length===1){sel.innerHTML=`<option value="${funcs[0].id}" selected>${esc(funcs[0].name)} (auto)</option>`;$('#barbeiroHint').textContent='Barbeiro único - selecionado automaticamente';}
 else {sel.innerHTML='<option value="">Selecione obrigatoriamente...</option>'+funcs.map(f=>`<option value="${f.id}">${esc(f.name)} - ${esc(f.perfil||'barbeiro')}</option>`).join('');$('#barbeiroHint').textContent='Selecione um barbeiro';}
 const{data:servs=[]}=await sb.from('services').select('*').eq('slug',CURRENT_SLUG).eq('active',true);
 $('#cliServico').innerHTML=servs.map(s=>`<option value="${s.id}">${esc(s.name)} - ${Number(s.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} (${s.duration}min)</option>`).join('')||'<option value="">Nenhum serviço</option>';
}
async function gerarHorariosDisponiveis(){
 const dataSel=$('#cliData').value;if(!dataSel)return;
 const barbeiroId=$('#cliBarbeiro').value;if(barbeiros.length>1&&!barbeiroId){$('#horariosDisponiveis').innerHTML='<p style="color:#f87171;font-size:12px">Selecione um barbeiro primeiro</p>';return;}
 // verifica dia da semana atende
 const dia=new Date(dataSel+'T12:00:00').getDay();const weekly=settings.weekly_schedule||{};const cfgDia=weekly[dia];if(cfgDia&&cfgDia.enabled===false){$('#horariosDisponiveis').innerHTML='<p style="color:#f87171">Fechado neste dia</p>';return;}
 const start=(cfgDia?.start||settings.start_time||'08:00').slice(0,5),end=(cfgDia?.end||settings.end_time||'18:00').slice(0,5),interval=Number(settings.slot_interval||30);
 const lunchS=(settings.lunch_start||'12:00').slice(0,5),lunchE=(settings.lunch_end||'13:00').slice(0,5);
 // busca agendamentos já feitos
 let q=sb.from('bookings').select('booking_time').eq('slug',CURRENT_SLUG).eq('booking_date',dataSel).neq('status','cancelled');if(barbeiroId)q=q.eq('professional_id',barbeiroId);const{data:ocupados=[]}=await q;
 const ocupSet=new Set(ocupados.map(o=>(o.booking_time||'').slice(0,5)));
 let h=Number(start.split(':')[0]),m=Number(start.split(':')[1]);const [eh,em]=end.split(':').map(Number);const [lh,lm]=lunchS.split(':').map(Number);const [lhe,lme]=lunchE.split(':').map(Number);let html='';
 while(h<eh||(h===eh&&m<em)){const t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;const cur=h*60+m,lS=lh*60+lm,lE=lhe*60+lme;if(!(cur>=lS&&cur<lE)){const ocupado=ocupSet.has(t);html+=`<button data-hora="${t}" class="btn ${ocupado?'':'gold'}" style="padding:10px;font-size:14px;${ocupado?'background:#1e1e1e;color:#555;cursor:not-allowed':''}" ${ocupado?'disabled':''}>${t}${ocupado?' (ocup)' : ''}</button>`;}m+=interval;if(m>=60){m-=60;h++;}}
 $('#horariosDisponiveis').innerHTML=html||'<p style="color:#666">Sem horários</p>';
 $$('#horariosDisponiveis [data-hora]').forEach(b=>{b.onclick=()=>{$$('#horariosDisponiveis [data-hora]').forEach(x=>{x.style.borderColor='#1e2230';x.style.background='#1e2230';});b.style.background='#d4af37';b.style.color='#000';selectedHora=b.dataset.hora;$('#btnConfirmarAgendamento').classList.remove('hidden');};});
}
async function listarMeusAgendamentos(){
 if(!currentUser)return;const{data:books=[]}=await sb.from('bookings').select('*,services(name)').eq('user_id',currentUser.id).eq('slug',CURRENT_SLUG).order('booking_date',{ascending:false}).order('booking_time');
 $('#listaMeusAgendamentos').innerHTML=books.length?books.map(b=>`<div class="list-row"><div><b>${b.booking_date.split('-').reverse().join('/')} ${(b.booking_time||'').slice(0,5)}</b><br><small>${esc(b.services?.name||'')} - ${esc(b.status)} - ${esc(b.client_name||'')}</small></div><div style="display:flex;flex-direction:column;gap:6px"><button data-editar="${b.id}" class="btn small" style="padding:6px 8px">Editar</button><button data-cancelar-cli="${b.id}" class="btn small danger" style="padding:6px 8px">Cancelar</button></div></div>`).join(''):'<p style="color:#666;text-align:center">Nenhum agendamento</p>';
}
document.addEventListener('click',async e=>{
 const t=e.target;
 if(t.id==='btnGoAgendar'){if(barbeiros.length>1&&!$('#cliBarbeiro').value){toast('Selecione um barbeiro');return;}$('#menuCliente').classList.add('hidden');$('#pageAgendar').classList.remove('hidden');$('#cliData').value=today();await loadSettingsCliente();await loadBarbeirosEServicos();await gerarHorariosDisponiveis();return;}
 if(t.id==='btnGoConsultar'){$('#menuCliente').classList.add('hidden');$('#pageConsultar').classList.remove('hidden');await listarMeusAgendamentos();return;}
 if(t.id==='btnVoltarMenu1'||t.id==='btnVoltarMenu2'){showMenu();return;}
 if(t.id==='btnCadastroCli'){const nome=$('#cliNome').value.trim(),phone=$('#cliPhone').value.trim(),email=$('#cliEmail').value.trim().toLowerCase(),senha=$('#cliSenha').value;if(!nome||!email||!senha){toast('Preencha nome, email e senha');return;}const{data,error}=await sb.auth.signUp({email,password:senha,options:{data:{name:nome,phone,role:'client'}}});if(error){toast(error.message);return;}if(data.user){await sb.from('profiles').upsert({id:data.user.id,name:nome,phone,email,role:'client',active:true});currentUser=data.user;$('#authClient').classList.add('hidden');$('#menuCliente').classList.remove('hidden');toast('Cadastro feito');}return;}
 if(t.id==='btnLoginCli'){const email=$('#cliLoginEmail').value.trim(),pass=$('#cliLoginSenha').value;const{data,error}=await sb.auth.signInWithPassword({email,password:pass});if(error){toast(error.message);return;}currentUser=data.user;$('#authClient').classList.add('hidden');$('#menuCliente').classList.remove('hidden');toast('Bem-vindo');return;}
 if(t.id==='btnLogoutCli'){await sb.auth.signOut();location.reload();return;}
 if(t.id==='btnConfirmarAgendamento'){
  if(!selectedHora){toast('Selecione horário');return;}const data=$('#cliData').value,servId=$('#cliServico').value,barbId=$('#cliBarbeiro').value;
  if(barbeiros.length>1&&!barbId){toast('Selecione barbeiro obrigatório');return;}
  if(!currentUser){toast('Faça login');return;}
  const{data:serv}=await sb.from('services').select('*').eq('id',servId).maybeSingle();
  const{data:prof}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
  const payload={slug:CURRENT_SLUG,booking_date:data,booking_time:selectedHora,service_id:servId,professional_id:barbId||null,user_id:currentUser.id,client_name:prof?.name||currentUser.email,phone:prof?.phone||'',status:'confirmed',price:serv?.price||0};
  const{error}=await sb.from('bookings').insert(payload);if(error){toast(error.message);return;}
  await sb.from('cash_entries').insert({slug:CURRENT_SLUG,type:'income',amount:serv?.price||0,entry_date:data,category:'servico',payment_method:'pix',description:`Agendamento ${payload.client_name} - ${serv?.name||''}`});
  toast('✅ Agendado para '+data+' às '+selectedHora);showMenu();return;
 }
 if(t.matches('[data-cancelar-cli]')){if(!confirm('Cancelar este agendamento?'))return;await sb.from('bookings').update({status:'cancelled'}).eq('id',t.dataset.cancelarCli);toast('Cancelado');await listarMeusAgendamentos();return;}
 if(t.matches('[data-editar]')){const id=t.dataset.editar;const{data:bk}=await sb.from('bookings').select('*').eq('id',id).maybeSingle();if(!bk)return;$('#menuCliente').classList.add('hidden');$('#pageConsultar').classList.add('hidden');$('#pageAgendar').classList.remove('hidden');$('#cliData').value=bk.booking_date;$('#cliBarbeiro').value=bk.professional_id||'';$('#cliServico').value=bk.service_id||'';selectedHora=bk.booking_time;await gerarHorariosDisponiveis();toast('Edite a data/horário e confirme - o antigo será cancelado ao confirmar');// ao confirmar novo, cancela antigo
  const btnConf=$('#btnConfirmarAgendamento');const oldClick=btnConf.onclick;btnConf.onclick=async()=>{await sb.from('bookings').update({status:'cancelled'}).eq('id',id);btnConf.onclick=oldClick;btnConf.click();};return;}
});
$('#cliData')?.addEventListener('change',gerarHorariosDisponiveis);
$('#cliBarbeiro')?.addEventListener('change',gerarHorariosDisponiveis);
async function initCliente(){
 localStorage.setItem('dnh_slug',CURRENT_SLUG);$('#shopSlug').textContent=CURRENT_SLUG;await loadSettingsCliente();await loadBarbeirosEServicos();
 const{data:{session}}=await sb.auth.getSession();if(session?.user){currentUser=session.user;$('#authClient').classList.add('hidden');$('#menuCliente').classList.remove('hidden');}
 sb.auth.onAuthStateChange((ev,sess)=>{if(sess?.user){currentUser=sess.user;$('#authClient').classList.add('hidden');$('#menuCliente').classList.remove('hidden');}else{currentUser=null;$('#authClient').classList.remove('hidden');$('#menuCliente').classList.add('hidden');}});
}
initCliente();