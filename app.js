// ... mantém todo seu app.js V12 até a função loadSuperFinance, só substitui essas 3 funções no final por essas:

async function loadBarbershops() {
  if (!isSuperAdmin()) { toast('Só super admin'); return; }
  const { data = [], error } = await sb.from('barbershops').select('*').order('created_at', { ascending: false });
  if (error) { $('#barbershopList').innerHTML = '<p>Erro: ' + escapeHtml(error.message) + '</p>'; return; }
  const base = location.href.split('?')[0];
  $('#barbershopList').innerHTML = data.map(b => `<div class="list-row"><div><b>${escapeHtml(b.name)}</b><small>Slug: ${escapeHtml(b.slug)} • ${b.active ? 'Ativo' : 'Inativo'}</small><small>Link cliente: ${base}?b=${escapeHtml(b.slug)}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button data-manage-shop="${b.slug}" class="btn gold">⚙️ Gerenciar</button><button data-copy-link="${base}?b=${b.slug}">Copiar Link</button><button class="danger" data-shop-delete="${b.id}">Excluir</button></div></div>`).join('') || '<p class="muted">Nenhuma</p>';
}

async function loadSuperFinance() {
  if (!isSuperAdmin()) return;
  const { data: shops = [] } = await sb.from('barbershops').select('*').order('name');
  const { data: pays = [] } = await sb.from('barbershop_payments').select('*').order('payment_date', { ascending: false });
  
  const list = $('#superFinanceList');
  if (!list) return;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0,7); // 2026-10

  let html = `<div style="display:flex;gap:10px;margin-bottom:16px;"><div class="stat"><small>Mês atual</small><b>${currentMonth}</b></div><div class="stat"><small>Total Recebido Mês</small><b>${money(pays.filter(p=>p.month_ref===currentMonth).reduce((a,b)=>a+Number(b.amount||0),0))}</b></div></div>`;

  html += shops.map(shop => {
    const shopPays = pays.filter(p => p.barbershop_slug === shop.slug);
    const lastPay = shopPays[0];
    const paidThisMonth = shopPays.some(p => p.month_ref === currentMonth);
    const statusClass = paidThisMonth ? '' : 'low-stock';
    const statusText = paidThisMonth ? `✅ PAGO EM ${currentMonth}` : `❌ NÃO PAGO - ${currentMonth}`;

    const history = shopPays.map(p => {
      const d = new Date(p.payment_date);
      const dataHora = d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px dashed #222;"><span>${dataHora} - Ref: ${p.month_ref} - ${p.method}</span><b>${money(p.amount)}</b> <button class="danger" data-del-pay="${p.id}" style="padding:2px 6px;font-size:10px">X</button></div>`;
    }).join('') || '<small class="muted">Nenhum pagamento</small>';

    return `
      <div class="list-row ${statusClass}" style="flex-direction:column;align-items:stretch;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <div><b>${escapeHtml(shop.name)} (${escapeHtml(shop.slug)})</b><br><small class="${paidThisMonth ? '' : 'stock-alert'}">${statusText}</small> ${lastPay ? `<small>Último: ${new Date(lastPay.payment_date).toLocaleString('pt-BR')} - ${money(lastPay.amount)}</small>` : ''}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <input type="month" id="month-${shop.slug}" value="${currentMonth}" style="width:140px;">
            <input type="number" id="amount-${shop.slug}" value="100" style="width:90px;" placeholder="Valor">
            <select id="method-${shop.slug}" style="width:100px;"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transf</option></select>
            <button data-add-pay="${shop.slug}" class="btn gold" style="padding:8px 12px;">+ Lançar Mensalidade</button>
            <button data-manage-shop="${shop.slug}" class="btn" style="background:#222;color:#fff;">Gerenciar</button>
          </div>
        </div>
        <details style="width:100%;margin-top:8px;"><summary style="cursor:pointer;color:#d4af37;font-size:13px;">Ver histórico completo (${shopPays.length})</summary><div style="margin-top:8px;background:#0a0a0a;padding:8px;border-radius:8px;">${history}</div></details>
      </div>`;
  }).join('');

  list.innerHTML = html || '<p class="muted">Nenhuma barbearia</p>';
}

async function addPayment(slug){
  const monthInput = document.getElementById(`month-${slug}`);
  const amountInput = document.getElementById(`amount-${slug}`);
  const methodInput = document.getElementById(`method-${slug}`);
  if(!monthInput || !amountInput) return;
  const month_ref = monthInput.value;
  const amount = Number(amountInput.value) || 0;
  const method = methodInput.value;
  if(!month_ref){ toast('Selecione o mês'); return; }
  const { error } = await sb.from('barbershop_payments').insert({ barbershop_slug: slug, amount, month_ref, method, payment_date: new Date().toISOString() });
  if(error){ toast(error.message); return; }
  toast(`Mensalidade ${month_ref} lançada para ${slug}`);
  await loadSuperFinance();
}

// E NO FINAL, DENTRO DO document.addEventListener('click'... ADICIONA ISSO:
  if (t.matches('[data-add-pay]')) await addPayment(t.dataset.addPay);
  if (t.matches('[data-del-pay]')) {
    if(!confirm('Excluir este pagamento?')) return;
    await sb.from('barbershop_payments').delete().eq('id', t.dataset.delPay);
    toast('Pagamento excluído');
    await loadSuperFinance();
  }
  if (t.matches('[data-manage-shop]')) {
    const slug = t.dataset.manageShop;
    localStorage.setItem('dnh_slug', slug);
    window.location.href = location.href.split('?')[0] + '?b=' + slug;
  }
