async function handleRecovery(){
  const hash = window.location.hash;
  if(!hash || !hash.includes('type=recovery')) return false;
  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if(!access_token) return false;
  // NÃO faz setSession automático, só mostra tela de criar senha
  document.body.innerHTML += `<div id="recoveryModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px"><div style="background:#111525;border:1px solid #d4af37;border-radius:16px;padding:28px;width:100%;max-width:400px"><h2 style="color:#d4af37;margin-bottom:8px">🔑 Criar Nova Senha</h2><p style="color:#8a8fa3;font-size:13px;margin-bottom:20px">Link válido! Defina a senha para: <b style="color:#fff" id="recoveryEmail"></b></p><div style="display:grid;gap:12px"><input id="newPass1" type="password" placeholder="Nova senha (mín 6)" style="padding:12px;border-radius:10px;border:1px solid #1e2230;background:#151a28;color:#fff"><input id="newPass2" type="password" placeholder="Confirmar senha" style="padding:12px;border-radius:10px;border:1px solid #1e2230;background:#151a28;color:#fff"><button id="btnSetPass" style="padding:14px;background:#d4af37;color:#000;border:none;border-radius:10px;font-weight:700;cursor:pointer">Definir Senha e Entrar</button><small id="recoveryMsg" style="color:#ff6b6b"></small></div></div></div>`;
  const email = params.get('email') || new URLSearchParams(hash).get('email') || 'este usuário';
  const emailEl = document.getElementById('recoveryEmail'); if(emailEl) emailEl.textContent = decodeURIComponent(email);
  
  // Guarda tokens para usar depois
  window._recovery_tokens = { access_token, refresh_token };
  
  document.getElementById('btnSetPass').onclick = async () => {
    const p1 = document.getElementById('newPass1').value;
    const p2 = document.getElementById('newPass2').value;
    const msg = document.getElementById('recoveryMsg');
    if(p1.length<6){ msg.textContent='Mínimo 6 caracteres'; return; }
    if(p1!==p2){ msg.textContent='Senhas não conferem'; return; }
    msg.textContent='Salvando...';
    const { error: sessErr } = await sb.auth.setSession(window._recovery_tokens);
    if(sessErr){ msg.textContent='Link expirado: '+sessErr.message; return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){ msg.textContent='Erro: '+error.message; }
    else {
      alert('✅ Senha criada! Você já está logado.');
      window.location.hash='';
      window.location.href = window.location.origin + window.location.pathname;
    }
  };
  return true;
}

function bindAuthButtons(){
  $$('.auth-tabs button').forEach(b=>{
    b.onclick=()=>{
      $$('.auth-tabs button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const signup=b.dataset.auth==='signup';
      const lf=$('#loginForm'); if(lf) lf.classList.toggle('hidden',signup);
      const sf=$('#signupForm'); if(sf) sf.classList.toggle('hidden',!signup);
    };
  });
  const lf=$('#loginForm');
  if(lf){
    lf.onsubmit=async(e)=>{
      e.preventDefault();
      const email=$('#loginEmail').value.trim();
      const pass=$('#loginPassword').value;
      const btn=lf.querySelector('button'); if(btn) btn.textContent='Entrando...';
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if(btn) btn.textContent='Entrar';
      if(error) alert('Login falhou: '+error.message);
    };
  }
  const sf=$('#signupForm');
  if(sf){
    sf.onsubmit=async(e)=>{
      e.preventDefault();
      const name=$('#signupName').value.trim(); const phone=$('#signupPhone').value.trim(); const email=$('#signupEmail').value.trim(); const password=$('#signupPassword').value;
      const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ name, phone, role:'client' } } });
      if(error){ toast(error.message); return; }
      if(data.session){ await sb.from('profiles').upsert({ id:data.user.id, name, phone, email, role:'client', active:true }); toast('Cadastrado'); } else { toast('Confirme o e-mail'); }
    };
  }
  if($('#logoutBtn')) $('#logoutBtn').onclick=()=>sb.auth.signOut();
}

async function init(){
  bindAuthButtons();
  const isRecovery = await handleRecovery();
  if(isRecovery) return; // Para aqui, não carrega resto se estiver em recovery
  
  sb.auth.onAuthStateChange(async(ev,sess)=>{
    if(sess){
      await user(); if(!profile) return;
      $('#authView')?.classList.add('hidden'); $('#appView')?.classList.remove('hidden');
      aplicarPermissoesUI(); await loadSettings();
      if(isSuperAdmin()) go('superadmin'); else go('dashboard');
    } else {
      profile=null; $('#authView')?.classList.remove('hidden'); $('#appView')?.classList.add('hidden');
    }
  });
  const { data:{ session } } = await sb.auth.getSession();
  if(session){
    await user();
    if(profile){
      $('#authView')?.classList.add('hidden'); $('#appView')?.classList.remove('hidden');
      aplicarPermissoesUI(); await loadSettings();
      if(isSuperAdmin()) go('superadmin'); else go('dashboard');
    }
  }
}
init();
