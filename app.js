async function openManageShopModal(slug){
  currentManageSlug=slug;
  const{data:shop}=await sb.from('barbershops').select('*').eq('slug',slug).maybeSingle();
  if(!shop){ toast('Não encontrada'); return; }
  $('#mShopName').value=shop.name||''; 
  $('#mShopSlug').value=shop.slug||''; 
  $('#mShopLogo').value=shop.logo_url||''; 
  $('#mShopOwner').value=shop.owner_email||''; 
  $('#mShopActive').checked=shop.active!==false;
  $('#manageShopTitle').textContent='Gerenciar: '+shop.name;
  const base=location.href.split('?')[0];
  if($('#mShopLink')) $('#mShopLink').textContent=base+'?b='+shop.slug;
  
  const{data:admins=[]}=await sb.from('professionals').select('*').eq('slug',slug).order('name');
  $('#mShopAdminsList').innerHTML=admins.length?admins.map(a=>`<div class="list-row" style="padding:10px 12px;margin:0;background:#1e1e1e;border-color:#2a2a2a;"><div><b style="color:#fff">${escapeHtml(a.name)}</b><small style="display:block;color:#aaa">${escapeHtml(a.email||'sem email')} • ${escapeHtml(a.perfil)} • ${escapeHtml(a.phone||'')}</small></div><div style="display:flex;gap:6px;"><button data-resend="${a.email}" style="padding:6px 8px;font-size:11px;background:#222;color:#d4af37;border:1px solid #d4af37;">Reenviar Acesso</button><button class="danger" data-remove-admin="${a.id}" style="padding:6px 8px;font-size:11px;">Remover</button></div></div>`).join(''):'<div style="padding:12px;text-align:center;color:#666;background:#1a1a1a;border-radius:10px;border:1px dashed #333;">Nenhum admin cadastrado ainda</div>';
  
  $('#manageShopModal').classList.remove('hidden'); $('#manageShopModal').style.display='flex';
}

async function saveManageShop(){
  if(!currentManageSlug) return;
  const payload={name:$('#mShopName').value.trim(),logo_url:$('#mShopLogo').value.trim()||'dnh-logo.png',owner_email:$('#mShopOwner').value.trim()||null,active:$('#mShopActive').checked};
  const{error}=await sb.from('barbershops').update(payload).eq('slug',currentManageSlug);
  if(error){ toast(error.message); return; }
  await sb.from('settings').update({name:payload.name,logo_url:payload.logo_url}).eq('slug',currentManageSlug);
  toast('Barbearia atualizada'); $('#manageShopModal').style.display='none'; await loadBarbershops();
}

async function addShopAdmin(){
  if(!currentManageSlug) return;
  const name=$('#mNewAdminName').value.trim();
  const email=$('#mNewAdminEmail').value.trim().toLowerCase();
  const phone=$('#mNewAdminPhone').value.trim();
  const perfil=$('#mNewAdminPerfil').value;
  if(!name||!email){ toast('Nome e E-mail são obrigatórios'); return; }
  
  $('#mAddAdminBtn').textContent='Criando...'; $('#mAddAdminBtn').disabled=true;

  // 1. Tenta criar usuário no Auth do Supabase
  const tempPass = Math.random().toString(36).slice(-8)+'A1!b2';
  let userId = null;
  const { data: signUpData, error: signUpError } = await sb.auth.signUp({
    email, password: tempPass,
    options: { data: { name, phone, role: 'admin' } }
  });

  if(signUpData?.user?.id){ userId = signUpData.user.id; }
  
  // 2. Se já existe, só vamos enviar o reset
  if(signUpError && !signUpError.message.toLowerCase().includes('already')){
    // se erro diferente de já existe, mostra mas continua
    console.log('signUpError', signUpError);
  }

  // 3. Envia e-mail de criação de senha / recuperação
  const { error: resetError } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  // 4. Cria/atualiza professional com e-mail
  const { error: profError } = await sb.from('professionals').upsert({
    name, phone, email, perfil, slug: currentManageSlug, active: true
  }, { onConflict: 'email,slug' });

  // 5. Cria/atualiza profile como admin
  if(userId){
    await sb.from('profiles').upsert({
      id: userId, name, phone, email, role: 'admin', active: true, barbershop_slug: currentManageSlug
    }, { onConflict: 'id' });
  }else{
    // se usuário já existia, atualiza role por email
    const { data: existing } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
    if(existing?.id){
      await sb.from('profiles').update({ role: 'admin', barbershop_slug: currentManageSlug, name, phone }).eq('id', existing.id);
    }
  }

  $('#mAddAdminBtn').textContent='✉️ Criar ADM e Enviar Acesso por E-mail'; $('#mAddAdminBtn').disabled=false;

  if(profError){ toast('Erro ao salvar: '+profError.message); return; }
  
  if(resetError){ toast('Admin criado, mas erro ao enviar e-mail: '+resetError.message); }
  else{ toast('✅ ADM criado! E-mail enviado para '+email+' com link para criar senha'); }

  $('#mNewAdminName').value=''; $('#mNewAdminEmail').value=''; $('#mNewAdminPhone').value='';
  await openManageShopModal(currentManageSlug);
  await loadBarbershops();
}

async function removeShopAdmin(id){ 
  if(!confirm('Remover este ADM da barbearia? O login continuará existindo mas sem acesso.')) return; 
  await sb.from('professionals').delete().eq('id',id); 
  toast('Removido'); 
  await openManageShopModal(currentManageSlug); 
}

async function resendAccess(email){
  if(!email){ toast('Sem e-mail'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if(error){ toast(error.message); } else { toast('Link reenviado para '+email); }
}
