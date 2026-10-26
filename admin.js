// ===== SÓ ADIÇÃO - CLIENTES / ANIVERSARIANTES =====
async function carregarAniversariantes(){
  try{
    const client = window.sb || supabase.createClient(window.DNH_CONFIG.supabaseUrl, window.DNH_CONFIG.supabaseAnonKey);
    const slug = localStorage.getItem('dnh_slug') || (location.pathname.split('/').filter(Boolean)[0] || 'dnh');
    const {data:clientes=[]} = await client.from('customers').select('*').eq('slug', slug);
    const elTotal = document.getElementById('totalClientes');
    if(elTotal) elTotal.textContent = clientes.length;
    const hoje = new Date(); const mesHoje = hoje.getMonth()+1; const diaHoje = hoje.getDate();
    const comNasc = clientes.filter(c=>c.birthdate);
    const doMes = comNasc.filter(c=> (new Date(c.birthdate+'T12:00:00').getMonth()+1)===mesHoje );
    const deHoje = doMes.filter(c=> new Date(c.birthdate+'T12:00:00').getDate()===diaHoje);
    doMes.sort((a,b)=> new Date(a.birthdate).getDate() - new Date(b.birthdate).getDate());
    const elMes = document.getElementById('totalAniversarioMes');
    if(elMes) elMes.textContent = doMes.length;
    const elLista = document.getElementById('listaAniversarioMes');
    if(elLista) elLista.innerHTML = doMes.map(c=>{
      const d = new Date(c.birthdate+'T12:00:00');
      const ehHoje = d.getDate()===diaHoje ? ' <b style="color:var(--gold)">- HOJE 🎉</b>' : '';
      const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da Barbearia! Parabéns pelo seu dia! 🎂✂️ Passa aqui essa semana que você tem 20% DE DESCONTO DE ANIVERSARIANTE! Quer agendar?`);
      return `• ${c.name} - ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} - ${c.phone} <a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="color:#25D366">WhatsApp</a>${ehHoje}`;
    }).join('<br>') || 'Nenhum esse mês';
    if(deHoje.length>0){
      const card = document.getElementById('cardAniversario');
      if(card){
        card.style.display='block';
        document.getElementById('listaAniversarioHoje').innerHTML = deHoje.map(c=>`🎉 <b>${c.name}</b> - ${c.phone} - faz aniversário hoje!`).join('<br>');
        document.getElementById('botoesAniversarioHoje').innerHTML = deHoje.map(c=>{
          const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da Barbearia! Parabéns pelo seu dia! 🎂 Hoje você tem 20% DE DESCONTO DE ANIVERSARIANTE, quer aproveitar e agendar seu corte?`);
          return `<a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="display:inline-block;margin:6px 6px 0 0;background:#25D366;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:700">WhatsApp ${c.name}</a>`;
        }).join('');
      }
    }
    const lista = document.getElementById('listaClientes');
    if(lista){
      const filtro = (document.getElementById('buscaCliente')?.value||'').toLowerCase();
      const filtrados = filtro ? clientes.filter(c=>c.name.toLowerCase().includes(filtro)||String(c.phone).includes(filtro)) : clientes;
      lista.innerHTML = filtrados.map(c=>{
        const d=c.birthdate?new Date(c.birthdate+'T12:00:00'):null;
        const nasc=d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'—';
        return `<div class="list-row"><div><b>${c.name}</b><br><small>${c.phone} • Nasc: ${nasc}</small></div><a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}" target="_blank"><button class="btn small">WhatsApp</button></a></div>`;
      }).join('') || 'Nenhum cliente ainda';
    }
  }catch(e){ console.log('aniversariantes', e); }
}
document.getElementById('buscaCliente')?.addEventListener('input', carregarAniversariantes);
document.querySelectorAll('.nav button').forEach(b=> b.addEventListener('click', ()=> setTimeout(carregarAniversariantes, 300)));
setTimeout(carregarAniversariantes, 1000);
