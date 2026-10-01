/* =========================================================
   DNH BARBEARIA
   APP.JS COMPLETO
   CONTROLE DE ACESSO ADMIN / CLIENTE
   ========================================================= */

const cfg = window.DNH_CONFIG || {};

const sb = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey
);

let profile = null;

let settings = {
    name: 'DNH BARBEARIA',
    whatsapp: '',
    start_time: '08:00',
    end_time: '18:00',
    slot_interval: 30,
    logo_url: 'dnh-logo.png',
    weekly_schedule: {}
};

let services = [];
let professionals = [];

const $ = selector => document.querySelector(selector);

const $$ = selector => [...document.querySelectorAll(selector)];

const today = () => {
    const d = new Date();

    return new Date(
        d.getTime() - d.getTimezoneOffset() * 60000
    )
        .toISOString()
        .slice(0, 10);
};

const money = value =>
    Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

const digits = value =>
    (value || '').replace(/\D/g, '');

function getWeeklySchedule(){
    const fallbackDay = (enabled, start, end) => ({
        enabled,
        start,
        end,
        lunch_start: '',
        lunch_end: ''
    });
    const start = settings.start_time?.slice(0,5) || '08:00';
    const end = settings.end_time?.slice(0,5) || '18:00';
    const fallback = {
        0: fallbackDay(false, start, end),
        1: fallbackDay(true, start, end),
        2: fallbackDay(true, start, end),
        3: fallbackDay(true, start, end),
        4: fallbackDay(true, start, end),
        5: fallbackDay(true, start, end),
        6: fallbackDay(false, start, end)
    };
    const current = settings.weekly_schedule && typeof settings.weekly_schedule === 'object' ? settings.weekly_schedule : {};
    return Object.fromEntries(Object.keys(fallback).map(k => [k, {...fallback[k], ...(current[k] || {})}]));
}

function scheduleForDate(date){
    const d = new Date(date + 'T12:00:00');
    const day = d.getDay();
    return getWeeklySchedule()[day] || {enabled:true,start:settings.start_time?.slice(0,5)||'08:00',end:settings.end_time?.slice(0,5)||'18:00'};
}

function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;',"\"":'&quot;'}[c]));
}


/* =========================================================
   CONTROLE DE ACESSO
   ========================================================= */

const ADMIN_PAGES = [
    'dashboard',
    'services',
    'clients',
    'stock',
    'finance',
    'team',
    'settings'
];

const CLIENT_PAGES = [
    'agenda',
    'consultar'
];


function isAdmin() {
    return profile?.role === 'admin';
}


function isClient() {
    return profile?.role === 'client';
}


function canAccessPage(page) {

    if (!profile) {
        return false;
    }

    if (isAdmin()) {
        return true;
    }

    return CLIENT_PAGES.includes(page);
}


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function toast(message) {

    if (!message) return;

    let el = $('#toast');

    if (!el) {

        el = document.createElement('div');

        el.id = 'toast';

        el.className = 'toast';

        document.body.appendChild(el);
    }

    el.textContent = message;

    el.classList.add('show');

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {

        el.classList.remove('show');

    }, 3000);
}


function showActionMessage(message, type = 'success') {
    let el = document.querySelector('#actionMessage');
    if (!el) {
        el = document.createElement('div');
        el.id = 'actionMessage';
        el.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:10001;padding:12px 16px;border-radius:10px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:420px;';
        document.body.appendChild(el);
    }
    el.style.background = type === 'error' ? '#7f1d1d' : '#166534';
    el.style.color = '#fff';
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(window.__actionMessageTimer);
    window.__actionMessageTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function configured() {

    return !!(
        cfg.supabaseUrl &&
        cfg.supabaseAnonKey
    );
}


/* =========================================================
   APLICAR PERMISSÕES NA INTERFACE
   ========================================================= */

function aplicarPermissoesUI() {

    const admin = isAdmin();


    /* -------------------------
       ELEMENTOS ADMIN
       ------------------------- */

    $$('.admin-only').forEach(el => {

        el.style.display =
            admin ? '' : 'none';

    });


    /* -------------------------
       ELEMENTOS CLIENTE
       ------------------------- */

    $$('.client-only').forEach(el => {

        el.style.display = admin ? 'none' : '';

    });


    /* -------------------------
       PÁGINAS ADMIN
       ------------------------- */

    ADMIN_PAGES.forEach(page => {

        const pageElement =
            $('#page-' + page);

        if (!pageElement) {
            return;
        }

        if (!admin) {

            pageElement.classList.remove(
                'active'
            );

        }

    });


    /* -------------------------
       BOTÕES DATA-PAGE ADMIN
       ------------------------- */

    $$('[data-page]').forEach(button => {

        const page = button.dataset.page;

        if (ADMIN_PAGES.includes(page)) {
            button.style.display = admin ? '' : 'none';
        }

        if (page === 'consultar' && isAdmin()) {
            button.style.display = 'none';
        }

    });
}


/* =========================================================
   AUTENTICAÇÃO / PERFIL
   ========================================================= */

async function user() {

    const {
        data: { user: authUser },
        error: authError
    } = await sb.auth.getUser();

    if (authError || !authUser) {
        profile = null;
        if (authError) console.error('Erro ao obter usuário autenticado:', authError);
        return null;
    }

    const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar perfil:', error);
        profile = null;
        return null;
    }

    if (data) {
        profile = data;
    } else {
        // Recupera automaticamente um perfil de cliente que tenha sido
        // removido da tabela profiles, mas cujo usuário ainda exista no Auth.
        const metadata = authUser.user_metadata || {};
        const fallbackProfile = {
            id: authUser.id,
            name: metadata.name || authUser.email?.split('@')[0] || 'Cliente',
            phone: metadata.phone || '',
            email: authUser.email || '',
            birth: metadata.birth || null,
            role: 'client',
            active: true
        };

        const { data: restored, error: restoreError } = await sb
            .from('profiles')
            .upsert(fallbackProfile, { onConflict: 'id' })
            .select('*')
            .maybeSingle();

        if (restoreError) {
            console.error('PERFIL AUSENTE E NÃO FOI POSSÍVEL RESTAURAR:', restoreError);
            profile = null;
            return null;
        }

        profile = restored || fallbackProfile;
        console.log('Perfil de cliente restaurado automaticamente:', profile);
    }

    console.log('PERFIL LOGADO:', profile);
    console.log('ROLE:', profile?.role);

    return profile;
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function go(page) {

    /* -------------------------
       VERIFICAR LOGIN
       ------------------------- */

    if (!profile) {

        console.warn(
            'Tentativa de navegação sem perfil.'
        );

        return;
    }


    /* -------------------------
       VERIFICAR PERMISSÃO
       ------------------------- */

    if (!canAccessPage(page)) {

        toast(
            'Acesso restrito ao administrador.'
        );


        /* Cliente sempre retorna para Agenda */

        if (isClient()) {

            page = 'agenda';

        } else {

            return;
        }
    }


    /* -------------------------
       ESCONDER TODAS AS PÁGINAS
       ------------------------- */

    $$('.page').forEach(p => {

        p.classList.remove('active');

    });


    /* -------------------------
       MOSTRAR PÁGINA
       ------------------------- */

    const target =
        $('#page-' + page);


    if (target) {

        target.classList.add(
            'active'
        );

    } else {

        console.warn(
            'Página não encontrada:',
            page
        );

        return;
    }


    /* -------------------------
       ATUALIZAR MENU
       ------------------------- */

    $$('[data-page]').forEach(btn => {

        btn.classList.toggle(
            'active',
            btn.dataset.page === page &&
            btn.style.display !== 'none'
        );

    });

    $$('[data-page=\"consultar\"]').forEach(btn => { btn.style.display = isAdmin() ? 'none' : ''; });


    /* -------------------------
       CARREGAR CONTEÚDO
       ------------------------- */

    if (page === 'dashboard') {

        if (isAdmin()) {
            dashboard();
        }

    }


    if (page === 'agenda') {

        agenda();

    }


    if (page === 'consultar') {

        consultarAgenda();

    }


    if (page === 'services') {

        if (isAdmin()) {
            loadServices();
        }

    }


    if (page === 'clients') {

        if (isAdmin()) {
            loadClients();
        }

    }


    if (page === 'stock') {

        if (isAdmin()) {
            loadStock();
        }

    }


    if (page === 'finance') {

        if (isAdmin()) {
            loadFinance();
        }

    }


    if (page === 'team') {

        if (isAdmin()) {
            loadTeam();
        }

    }


    if (page === 'settings') {

        if (isAdmin()) {
            loadSettings();
        }

    }
}


/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

async function loadSettings() {

    const {
        data,
        error
    } = await sb
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();


    if (error) {

        console.error(
            'Erro ao carregar configurações:',
            error
        );

        return;
    }


    if (data) {

        settings = {
            ...settings,
            ...data
        };

    }


    if ($('#setName')) {

        $('#setName').value =
            settings.name ||
            'DNH BARBEARIA';

    }


    if ($('#setWhatsapp')) {

        $('#setWhatsapp').value =
            settings.whatsapp ||
            '';

    }


    if ($('#setStart')) {

        $('#setStart').value =
            settings.start_time?.slice(0, 5) ||
            '08:00';

    }


    if ($('#setEnd')) {

        $('#setEnd').value =
            settings.end_time?.slice(0, 5) ||
            '18:00';

    }


    if ($('#setInterval')) {

        $('#setInterval').value =
            settings.slot_interval ||
            30;

    }


    if ($('#setLogoUrl')) {

        $('#setLogoUrl').value =
            settings.logo_url ||
            'dnh-logo.png';

    }

    const weekly = getWeeklySchedule();
    $$('[data-weekday]').forEach(row => {
        const day = row.dataset.weekday;
        const cfg = weekly[day] || {};
        const enabled = row.querySelector('[data-week-enabled]');
        const start = row.querySelector('[data-week-start]');
        const end = row.querySelector('[data-week-end]');
        const lunchStart = row.querySelector('[data-week-lunch-start]');
        const lunchEnd = row.querySelector('[data-week-lunch-end]');
        const isEnabled = cfg.enabled !== false;
        if (enabled) enabled.checked = isEnabled;
        if (start) start.value = cfg.start || settings.start_time?.slice(0,5) || '08:00';
        if (end) end.value = cfg.end || settings.end_time?.slice(0,5) || '18:00';
        if (lunchStart) lunchStart.value = cfg.lunch_start || '';
        if (lunchEnd) lunchEnd.value = cfg.lunch_end || '';
        if (start) start.disabled = !isEnabled;
        if (end) end.disabled = !isEnabled;
        if (lunchStart) lunchStart.disabled = !isEnabled;
        if (lunchEnd) lunchEnd.disabled = !isEnabled;
        const nameEl = row.querySelector('[data-week-name]');
        if (nameEl) {
            const baseName = nameEl.dataset.baseName || nameEl.textContent.replace(/\s+—.*$/, '').trim();
            nameEl.dataset.baseName = baseName;
            nameEl.textContent = isEnabled ? baseName : `${baseName} — NÃO ATENDE`;
        }
    });


    if ($('#shareUrl')) {

        $('#shareUrl').textContent =
            location.href.split('?')[0];

    }


    if ($('#brandName')) {

        $('#brandName').textContent =
            settings.name ||
            'DNH BARBEARIA';

    }


    if ($('#brandLogo')) {

        $('#brandLogo').src =
            settings.logo_url ||
            'dnh-logo.png';

    }
}


/* =========================================================
   SERVIÇOS
   ========================================================= */

async function loadServices() {

    const {
        data = [],
        error
    } = await sb
        .from('services')
        .select('*')
        .order('name');


    if (error) {

        console.error(
            'Erro ao carregar serviços:',
            error
        );


        if ($('#serviceList')) {

            $('#serviceList').innerHTML =
                '<p class="muted">Não foi possível carregar os serviços.</p>';

        }

        return;
    }


    services = data || [];


    /* -------------------------
       LISTA ADMIN
       ------------------------- */

    if ($('#serviceList')) {

        if (!services.length) {

            $('#serviceList').innerHTML =
                '<p class="muted">Nenhum serviço cadastrado.</p>';

        } else {

            $('#serviceList').innerHTML =
                services.map(service => {

                    return `
                        <div class="list-row">

                            <div>

                                <b>
                                    ${service.name}
                                </b>

                                <small>
                                    ${money(service.price)}
                                    •
                                    ${Number(service.duration) || 30} min
                                </small>

                            </div>

                            <div
                                style="
                                    display:flex;
                                    gap:6px;
                                    align-items:center;
                                    flex-wrap:wrap;
                                "
                            >

                                <span
                                    class="${
                                        service.active
                                            ? 'ok'
                                            : 'cancel'
                                    }"
                                >
                                    ${
                                        service.active
                                            ? 'Ativo'
                                            : 'Inativo'
                                    }
                                </span>

                                <button
                                    type="button"
                                    data-service-edit="${service.id}"
                                >
                                    Editar
                                </button>

                                <button
                                    type="button"
                                    data-service-toggle="${service.id}"
                                >
                                    ${
                                        service.active
                                            ? 'Desativar'
                                            : 'Ativar'
                                    }
                                </button>

                                <button
                                    type="button"
                                    class="danger"
                                    data-service-delete="${service.id}"
                                >
                                    Excluir
                                </button>

                            </div>

                        </div>
                    `;

                }).join('');
        }
    }


    /* -------------------------
       SELECT DO CLIENTE
       ------------------------- */

    if ($('#clientService')) {

        const current =
            $('#clientService').value;


        const activeServices =
            services.filter(
                s => s.active !== false
            );


        $('#clientService').innerHTML = `

            <option value="">
                Selecione o serviço
            </option>

            ${activeServices.map(s => `

                <option value="${s.id}">

                    ${s.name}
                    -
                    ${money(s.price)}
                    -
                    ${Number(s.duration) || 30} min

                </option>

            `).join('')}

        `;


        if (
            current &&
            activeServices.some(
                s => s.id === current
            )
        ) {

            $('#clientService').value =
                current;

        }
    }
}


async function excluirServico(serviceId) {
    if (!isAdmin()) return;
    const service = services.find(s => String(s.id) === String(serviceId));
    if (!service) { toast('Serviço não encontrado.'); return; }
    if (!confirm(`Excluir o serviço "${service.name || 'Serviço'}"?`)) return;

    const { count, error: checkError } = await sb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId);

    if (checkError) {
        console.error('Erro ao verificar agendamentos do serviço:', checkError);
        toast('Não foi possível verificar o uso do serviço.');
        showActionMessage('Não foi possível excluir o serviço.', 'error');
        return;
    }

    if (Number(count || 0) > 0) {
        const msg = 'Este serviço possui agendamentos vinculados e não pode ser excluído. Use Desativar para retirá-lo de novos agendamentos.';
        toast(msg);
        showActionMessage(msg, 'error');
        return;
    }

    const { error } = await sb.from('services').delete().eq('id', serviceId);
    if (error) {
        console.error('Erro ao excluir serviço:', error);
        const msg = error.code === '23503' ? 'Serviço possui registros vinculados e não pode ser excluído.' : (error.message || 'Não foi possível excluir o serviço.');
        toast(msg);
        showActionMessage(msg, 'error');
        return;
    }

    toast('Serviço excluído com sucesso.');
    showActionMessage('Serviço excluído com sucesso.');
    await loadServices();
}

/* =========================================================
   EDITAR SERVIÇO
   ========================================================= */

async function editarServico(serviceId) {

    if (!isAdmin()) {
        toast('Acesso restrito ao administrador.');
        return;
    }

    const service =
        services.find(
            s => s.id === serviceId
        );

    if (!service) {
        toast('Serviço não encontrado.');
        return;
    }

    const oldModal = $('#editServiceModal');

    if (oldModal) {
        oldModal.remove();
    }

    const modal = document.createElement('div');

    modal.id = 'editServiceModal';

    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:9999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(0,0,0,.65);
    `;

    modal.innerHTML = `

        <div
            style="
                width:min(100%,460px);
                background:var(--card,#fff);
                color:inherit;
                border-radius:16px;
                padding:22px;
                box-shadow:0 20px 60px rgba(0,0,0,.30);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:12px;
                    margin-bottom:18px;
                "
            >

                <h3 style="margin:0;">
                    Editar serviço
                </h3>

                <button
                    type="button"
                    id="closeEditService"
                    aria-label="Fechar"
                >
                    ✕
                </button>

            </div>

            <form id="editServiceForm">

                <label style="display:block;margin-bottom:6px;">
                    Nome do serviço
                </label>

                <input
                    type="text"
                    id="editServiceName"
                    value="${String(service.name || '')
                        .replace(/"/g, '&quot;')}"
                    required
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:14px;
                    "
                >

                <label style="display:block;margin-bottom:6px;">
                    Preço (R$)
                </label>

                <input
                    type="text"
                    id="editServicePrice"
                    inputmode="decimal"
                    value="${String(service.price ?? 0)
                        .replace('.', ',')}"
                    required
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:14px;
                    "
                >

                <label style="display:block;margin-bottom:6px;">
                    Tempo / duração (minutos)
                </label>

                <input
                    type="number"
                    id="editServiceDuration"
                    min="1"
                    step="1"
                    value="${Number(service.duration) || 30}"
                    required
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:20px;
                    "
                >

                <div
                    style="
                        display:flex;
                        justify-content:flex-end;
                        gap:8px;
                        flex-wrap:wrap;
                    "
                >

                    <button
                        type="button"
                        id="cancelEditService"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </div>

    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.remove();
    };

    $('#closeEditService')?.addEventListener(
        'click',
        closeModal
    );

    $('#cancelEditService')?.addEventListener(
        'click',
        closeModal
    );

    modal.addEventListener(
        'click',
        e => {
            if (e.target === modal) {
                closeModal();
            }
        }
    );

    $('#editServiceForm')?.addEventListener(
        'submit',
        async e => {

            e.preventDefault();

            const name =
                $('#editServiceName')
                    ?.value
                    .trim();

            const priceText =
                $('#editServicePrice')
                    ?.value
                    .trim();

            const durationText =
                $('#editServiceDuration')
                    ?.value
                    .trim();

            const normalizedPrice =
                String(priceText)
                    .replace(/\s/g, '')
                    .trim();

            const cleanPrice =
                normalizedPrice.includes(',')
                    ? normalizedPrice
                        .replace(/\./g, '')
                        .replace(',', '.')
                    : normalizedPrice;

            const price =
                Number(cleanPrice);

            const duration =
                Number(durationText);

            if (
                !name ||
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                toast(
                    'Informe nome, preço e tempo válidos.'
                );
                return;
            }

            const saveButton =
                $('#editServiceForm button[type="submit"]');

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = 'Salvando...';
            }

            const {
                error
            } = await sb
                .from('services')
                .update({
                    name,
                    price,
                    duration
                })
                .eq(
                    'id',
                    serviceId
                );

            if (error) {

                console.error(
                    'Erro ao editar serviço:',
                    error
                );

                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent =
                        'Salvar alterações';
                }

                toast(
                    error.message ||
                    'Não foi possível editar o serviço.'
                );

                return;
            }

            service.name =
                name;

            service.price =
                price;

            service.duration =
                duration;

            closeModal();

            toast(
                'Serviço atualizado com sucesso.'
            );

            await loadServices();

            if (
                $('#clientService')?.value ===
                serviceId
            ) {
                await loadClientTimes();
            }

        }
    );

    $('#editServiceName')?.focus();
}


/* =========================================================
   PROFISSIONAIS
   ========================================================= */

async function loadProfessionals() {

    const {
        data = [],
        error
    } = await sb
        .from('professionals')
        .select('*')
        .eq('active', true)
        .order('name');


    if (error) {

        console.error(
            'Erro ao carregar profissionais:',
            error
        );

        professionals = [];

        return;
    }


    professionals = data || [];


    if ($('#clientProfessional')) {

        const current =
            $('#clientProfessional').value;


        $('#clientProfessional').innerHTML = `

            <option value="">
                Selecione o profissional
            </option>

            ${professionals.map(p => `

                <option value="${p.id}">
                    ${p.name}
                </option>

            `).join('')}

        `;


        if (
            current &&
            professionals.some(
                p => p.id === current
            )
        ) {

            $('#clientProfessional').value =
                current;

        }
    }


    if ($('#agendaProfessional')) {

        const current =
            $('#agendaProfessional').value;


        $('#agendaProfessional').innerHTML = `

            <option value="">
                Todos os profissionais
            </option>

            ${professionals.map(p => `

                <option value="${p.id}">
                    ${p.name}
                </option>

            `).join('')}

        `;


        if (
            current &&
            professionals.some(
                p => p.id === current
            )
        ) {

            $('#agendaProfessional').value =
                current;

        }
    }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function dashboard() {

    if (!isAdmin()) {
        return;
    }


    await loadSettings();


    const month =
        today().slice(0, 7);


    const {
        data: bookings = [],
        error: bookingError
    } = await sb
        .from('bookings')
        .select(`
            id,
            booking_time,
            status,
            service_id,
            user_id
        `)
        .eq(
            'booking_date',
            today()
        )
        .order(
            'booking_time'
        );


    if (bookingError) {

        console.error(
            'Erro dashboard bookings:',
            bookingError
        );

    }


    const {
        count: clientCount,
        error: clientError
    } = await sb
        .from('profiles')
        .select('*', {
            count: 'exact',
            head: true
        })
        .eq(
            'role',
            'client'
        );


    if (clientError) {

        console.error(
            'Erro dashboard clientes:',
            clientError
        );

    }


    const {
        data: finance = [],
        error: financeError
    } = await sb
        .from('cash_entries')
        .select('*')
        .gte(
            'entry_date',
            month + '-01'
        )
        .lte(
            'entry_date',
            month + '-31'
        );


    if (financeError) {

        console.error(
            'Erro dashboard financeiro:',
            financeError
        );

    }


    const {
        data: clients = [],
        error: birthdayError
    } = await sb
        .from('profiles')
        .select(
            'id,name,birth,phone'
        )
        .eq(
            'role',
            'client'
        );

    if (birthdayError) {
        console.error(
            'Erro ao carregar aniversariantes:',
            birthdayError
        );

        if ($('#birthdayList')) {
            $('#birthdayList').innerHTML =
                '<p class="muted">Não foi possível carregar os aniversariantes.</p>';
        }
    }


    if ($('#kToday')) {

        $('#kToday').textContent =
            bookings.filter(
                x =>
                    x.status ===
                    'confirmed'
            ).length;

    }


    if ($('#kClients')) {

        $('#kClients').textContent =
            clientCount || 0;

    }


    if ($('#kRevenue')) {

        const revenue =
            finance
                .filter(
                    x =>
                        x.type ===
                        'income'
                )
                .reduce(
                    (total, x) =>
                        total +
                        Number(
                            x.amount || 0
                        ),
                    0
                );


        $('#kRevenue').textContent =
            money(revenue);

    }


    /* ---------------------------------------------------------
       ANIVERSARIANTES DO MÊS
       Normaliza a data para YYYY-MM-DD antes do filtro.
       Isso evita problemas caso o Supabase devolva a data
       como string em outro formato/representação.
       --------------------------------------------------------- */

    const currentMonth =
        today().slice(5, 7);

    const birthdays =
        (Array.isArray(clients) ? clients : [])
            .filter(client => {

                if (!client?.birth) {
                    return false;
                }

                const birth =
                    String(client.birth)
                        .trim()
                        .slice(0, 10);

                return (
                    /^\d{4}-\d{2}-\d{2}$/.test(birth) &&
                    birth.slice(5, 7) === currentMonth
                );
            })
            .sort((a, b) => {

                const dayA = Number(
                    String(a.birth).slice(8, 10)
                );

                const dayB = Number(
                    String(b.birth).slice(8, 10)
                );

                return dayA - dayB;
            });

    console.log(
        'ANIVERSARIANTES DO MÊS:',
        birthdays
    );


    if ($('#kBirthdays')) {

        $('#kBirthdays').textContent =
            birthdays.length;

    }


    if ($('#todayList')) {

        $('#todayList').innerHTML =
            bookings.length

                ? bookings.map(b => `

                    <div class="agenda-row">

                        <div>

                            <b>
                                ${
                                    b.booking_time
                                        ?.slice(0, 5) ||
                                    ''
                                }
                            </b>

                            <small>
                                Agendamento
                            </small>

                        </div>

                        <span
                            class="${
                                b.status ===
                                'cancelled'
                                    ? 'cancel'
                                    : 'ok'
                            }"
                        >
                            ${
                                b.status ===
                                'cancelled'
                                    ? 'Cancelado'
                                    : b.status ===
                                      'completed'
                                        ? 'Concluído'
                                        : 'Confirmado'
                            }
                        </span>

                    </div>

                `).join('')

                : '<p class="muted">Nenhum agendamento hoje.</p>';
    }


    if ($('#birthdayList')) {

        $('#birthdayList').innerHTML =
            birthdays
                .slice(0, 6)
                .map(c => {

                    const birth =
                        String(c.birth)
                            .trim()
                            .slice(0, 10);

                    const day =
                        birth.slice(8, 10);

                    const birthMonth =
                        birth.slice(5, 7);

                    const isToday =
                        birth.slice(5, 10) ===
                        today().slice(5, 10);

                    return `

                    <div class="list-row">

                        <div>

                            <b>
                                🎂
                                ${c.name || 'Cliente'}
                            </b>

                            <small>
                                ${day}/${birthMonth}
                                •
                                ${c.phone || ''}
                            </small>

                        </div>

                        <span>
                            ${isToday ? 'Hoje' : ''}
                        </span>

                    </div>

                `;
                })
                .join('')

            ||
            '<p class="muted">Nenhum aniversariante este mês.</p>';
    }
}


/* =========================================================
   HORÁRIOS
   ========================================================= */

function slots() {

    const result = [];


    let [
        hour,
        minute
    ] =
        settings.start_time
            .slice(0, 5)
            .split(':')
            .map(Number);


    const [
        endHour,
        endMinute
    ] =
        settings.end_time
            .slice(0, 5)
            .split(':')
            .map(Number);


    let current =
        hour * 60 + minute;


    const end =
        endHour * 60 +
        endMinute;


    const interval =
        Number(
            settings.slot_interval
        ) || 30;


    while (current < end) {

        result.push(
            String(
                Math.floor(
                    current / 60
                )
            ).padStart(2, '0')
            +
            ':'
            +
            String(
                current % 60
            ).padStart(2, '0')
        );


        current += interval;
    }


    return result;
}


function timeToMinutes(time) {

    const [
        h,
        m
    ] =
        time
            .split(':')
            .map(Number);


    return h * 60 + m;
}


/* =========================================================
   AGENDA ADMIN
   ========================================================= */

async function agenda() {

    /* =========================================================
       CONTROLE POR PERFIL
       ========================================================= */

    if (!profile) {
        return;
    }

    /* ADMINISTRADOR — CALENDÁRIO / AGENDA */

    if (isAdmin()) {

        await loadSettings();
        await loadProfessionals();

        const page = $('#page-agenda');
        const clientAgenda = $('#clientAgenda');
        const adminAgenda = $('#adminAgenda');

        if (!page || !adminAgenda) {
            return;
        }

        if (clientAgenda) {
            clientAgenda.classList.add('hidden');
        }

        adminAgenda.classList.remove('hidden');


        adminAgenda.innerHTML = `

            <div class="page-header">

                <div>

                    <h1>Agenda</h1>

                    <p class="muted">
                        Todos os agendamentos da barbearia organizados por dia e horário.
                    </p>

                </div>

                <button type="button" class="btn gold" data-admin-new-booking>+ Novo agendamento</button>

            </div>


            <!-- FILTROS -->

            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(190px, 1fr)
                        );
                    gap:12px;
                    margin:20px 0;
                "
            >

                <div>

                    <label
                        for="adminAgendaDate"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Data
                    </label>

                    <input
                        type="date"
                        id="adminAgendaDate"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                </div>


                <div>

                    <label
                        for="adminAgendaProfessional"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Profissional
                    </label>

                    <select
                        id="adminAgendaProfessional"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                        <option value="">
                            Todos os profissionais
                        </option>

                    </select>

                </div>


                <div
                    style="
                        display:flex;
                        align-items:flex-end;
                    "
                >

                    <button
                        type="button"
                        id="adminAgendaClear"
                        style="width:100%;"
                    >
                        Mostrar todos
                    </button>

                </div>

            </div>


            <!-- RESUMO -->

            <div
                id="adminAgendaSummary"
                style="
                    margin:0 0 16px 0;
                "
            ></div>


            <!-- CALENDÁRIO -->

            <div
                id="adminAgendaCalendar"
                style="
                    display:grid;
                    gap:18px;
                "
            >

                <p class="muted">
                    Carregando agenda...
                </p>

            </div>

        `;


        $('#adminAgenda [data-admin-new-booking]')?.addEventListener('click', novoAgendamentoAdmin);

        const professionalSelect =
            $('#adminAgendaProfessional');


        if (professionalSelect) {

            professionals.forEach(
                professional => {

                    const option =
                        document.createElement(
                            'option'
                        );

                    option.value =
                        professional.id;

                    option.textContent =
                        professional.name;

                    professionalSelect.appendChild(
                        option
                    );

                }
            );

        }


        const dateInput =
            $('#adminAgendaDate');


        const professionalInput =
            $('#adminAgendaProfessional');


        const clearButton =
            $('#adminAgendaClear');

        if (dateInput) {
            dateInput.value = today();
        }


        /* =====================================================
           CARREGAR CALENDÁRIO
           ===================================================== */

        async function carregarAgendaAdmin() {

            const calendar =
                $('#adminAgendaCalendar');

            const summary =
                $('#adminAgendaSummary');


            if (!calendar) {
                return;
            }


            calendar.innerHTML = `
                <p class="muted">
                    Carregando agenda...
                </p>
            `;


            let query =
                sb
                    .from('bookings')
                    .select(`
                        id,
                        booking_date,
                        booking_time,
                        status,
                        professional_id,
                        service_id,
                        user_id
                    `)
                    .order(
                        'booking_date',
                        {
                            ascending: true
                        }
                    )
                    .order(
                        'booking_time',
                        {
                            ascending: true
                        }
                    );


            const filterDate =
                dateInput?.value || '';


            const filterProfessional =
                professionalInput?.value || '';


            if (filterDate) {

                query =
                    query.eq(
                        'booking_date',
                        filterDate
                    );

            }


            if (filterProfessional) {

                query =
                    query.eq(
                        'professional_id',
                        filterProfessional
                    );

            }


            const {
                data: bookings = [],
                error
            } = await query;


            if (error) {

                console.error(
                    'Erro ao carregar agenda do administrador:',
                    error
                );


                calendar.innerHTML = `

                    <div
                        style="
                            padding:20px;
                            border:1px solid rgba(128,128,128,.25);
                            border-radius:14px;
                        "
                    >

                        <strong>
                            Não foi possível carregar a agenda.
                        </strong>

                        <small
                            class="muted"
                            style="display:block;margin-top:6px;"
                        >
                            ${error.message || ''}
                        </small>

                    </div>

                `;

                if (summary) {
                    summary.textContent = '';
                }

                return;
            }


            if (summary) {

                summary.innerHTML = `

                    <div
                        style="
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                            align-items:center;
                        "
                    >

                        <strong>
                            ${bookings.length}
                            agendamento(s)
                        </strong>

                        <span class="muted">
                            ${
                                filterDate
                                    ? 'na data selecionada'
                                    : 'em todos os períodos'
                            }
                        </span>

                    </div>

                `;

            }


            if (!bookings.length) {

                calendar.innerHTML = `

                    <div
                        style="
                            padding:28px 20px;
                            text-align:center;
                            border:1px dashed rgba(128,128,128,.35);
                            border-radius:14px;
                        "
                    >

                        <strong>
                            Nenhum agendamento encontrado.
                        </strong>

                        <p
                            class="muted"
                            style="margin:8px 0 0;"
                        >
                            Tente outra data ou profissional.
                        </p>

                    </div>

                `;

                return;
            }


            /* =================================================
               BUSCAR DADOS RELACIONADOS
               ================================================= */

            const serviceIds =
                [
                    ...new Set(
                        bookings
                            .map(
                                booking =>
                                    booking.service_id
                            )
                            .filter(Boolean)
                    )
                ];


            const userIds =
                [
                    ...new Set(
                        bookings
                            .map(
                                booking =>
                                    booking.user_id
                            )
                            .filter(Boolean)
                    )
                ];


            const professionalIds =
                [
                    ...new Set(
                        bookings
                            .map(
                                booking =>
                                    booking.professional_id
                            )
                            .filter(Boolean)
                    )
                ];


            let serviceMap =
                new Map();


            let profileMap =
                new Map();


            let professionalMap =
                new Map();


            if (serviceIds.length) {

                const {
                    data: serviceData = []
                } =
                    await sb
                        .from('services')
                        .select(
                            'id,name,duration,price'
                        )
                        .in(
                            'id',
                            serviceIds
                        );


                serviceMap =
                    new Map(
                        serviceData.map(
                            service => [
                                service.id,
                                service
                            ]
                        )
                    );

            }


            if (userIds.length) {

                const {
                    data: profileData = []
                } =
                    await sb
                        .from('profiles')
                        .select(
                            'id,name,phone,email'
                        )
                        .in(
                            'id',
                            userIds
                        );


                profileMap =
                    new Map(
                        profileData.map(
                            profile => [
                                profile.id,
                                profile
                            ]
                        )
                    );

            }


            if (professionalIds.length) {

                const {
                    data: professionalData = []
                } =
                    await sb
                        .from('professionals')
                        .select(
                            'id,name'
                        )
                        .in(
                            'id',
                            professionalIds
                        );


                professionalMap =
                    new Map(
                        professionalData.map(
                            professional => [
                                professional.id,
                                professional
                            ]
                        )
                    );

            }


            /* =================================================
               AGRUPAR POR DATA
               ================================================= */

            const groups =
                new Map();


            bookings.forEach(
                booking => {

                    const date =
                        booking.booking_date ||
                        'sem-data';


                    if (!groups.has(date)) {

                        groups.set(
                            date,
                            []
                        );

                    }


                    groups
                        .get(date)
                        .push(booking);

                }
            );


            /* =================================================
               STATUS
               ================================================= */

            services.forEach(s => { if (!serviceMap.has(s.id)) serviceMap.set(s.id, s); });
    professionals.forEach(p => { if (!professionalMap.has(p.id)) professionalMap.set(p.id, p); });


    function statusInfo(status) {

                switch (status) {

                    case 'completed':

                        return {
                            text:
                                'Concluído',
                            className:
                                'ok'
                        };


                    case 'cancelled':

                        return {
                            text:
                                'Cancelado',
                            className:
                                'cancel'
                        };


                    case 'in_progress':

                        return {
                            text:
                                'Em atendimento',
                            className:
                                'progress'
                        };


                    default:

                        return {
                            text:
                                'Confirmado',
                            className:
                                'ok'
                        };

                }

            }


            /* =================================================
               DATA
               ================================================= */

            function formatDate(date) {

                if (!date) {
                    return '-';
                }


                const [
                    year,
                    month,
                    day
                ] =
                    date.split('-');


                return (
                    day +
                    '/' +
                    month +
                    '/' +
                    year
                );

            }


            function dayName(date) {

                if (!date) {
                    return '';
                }


                const parts =
                    date
                        .split('-')
                        .map(Number);


                const value =
                    new Date(
                        parts[0],
                        parts[1] - 1,
                        parts[2]
                    );


                return value.toLocaleDateString(
                    'pt-BR',
                    {
                        weekday:
                            'long'
                    }
                );

            }


            /* =================================================
               MONTAR CALENDÁRIO
               ================================================= */

            calendar.innerHTML =
                Array.from(
                    groups.entries()
                )
                .map(
                    ([date, dayBookings]) => {

                        dayBookings.sort(
                            (a, b) =>
                                String(
                                    a.booking_time || ''
                                ).localeCompare(
                                    String(
                                        b.booking_time || ''
                                    )
                                )
                        );


                        const cards =
                            dayBookings
                                .map(
                                    booking => {

                                        const service =
                                            serviceMap.get(
                                                booking.service_id
                                            );


                                        const client =
                                            profileMap.get(
                                                booking.user_id
                                            );


                                        const professional =
                                            professionalMap.get(
                                                booking.professional_id
                                            );


                                        const status =
                                            statusInfo(
                                                booking.status
                                            );


                                        const clientName =
                                            client?.name ||
                                            'Cliente';


                                        const phone =
                                            client?.phone ||
                                            '';


                                        const serviceName =
                                            service?.name ||
                                            'Serviço';


                                        const professionalName =
                                            professional?.name ||
                                            'Não informado';


                                        const duration =
                                            Number(
                                                service?.duration
                                            ) || 30;


                                        const price =
                                            money(
                                                service?.price
                                            );


                                        const time =
                                            booking.booking_time
                                                ?.slice(
                                                    0,
                                                    5
                                                ) ||
                                            '--:--';


                                        const cancelled =
                                            booking.status ===
                                            'cancelled';


                                        return `

                                            <div
                                                style="
                                                    display:grid;
                                                    grid-template-columns:
                                                        82px
                                                        1fr;
                                                    gap:14px;
                                                    padding:14px;
                                                    border-top:1px solid rgba(128,128,128,.18);
                                                "
                                            >

                                                <!-- HORÁRIO -->

                                                <div
                                                    style="
                                                        font-size:18px;
                                                        font-weight:700;
                                                        padding-top:2px;
                                                    "
                                                >
                                                    ${time}

                                                    <small
                                                        class="muted"
                                                        style="
                                                            display:block;
                                                            font-size:11px;
                                                            font-weight:400;
                                                            margin-top:3px;
                                                        "
                                                    >
                                                        ${duration} min
                                                    </small>

                                                </div>


                                                <!-- AGENDAMENTO -->

                                                <div>

                                                    <div
                                                        style="
                                                            display:flex;
                                                            justify-content:space-between;
                                                            align-items:flex-start;
                                                            gap:10px;
                                                            flex-wrap:wrap;
                                                        "
                                                    >

                                                        <div>

                                                            <strong
                                                                style="
                                                                    font-size:16px;
                                                                "
                                                            >
                                                                ${clientName}
                                                            </strong>

                                                            ${
                                                                phone
                                                                    ? `
                                                                        <small
                                                                            class="muted"
                                                                            style="
                                                                                display:block;
                                                                                margin-top:2px;
                                                                            "
                                                                        >
                                                                            📱 ${phone}
                                                                        </small>
                                                                    `
                                                                    : ''
                                                            }

                                                        </div>


                                                        <span
                                                            class="${status.className}"
                                                        >
                                                            ${status.text}
                                                        </span>

                                                    </div>


                                                    <div
                                                        style="
                                                            display:flex;
                                                            gap:14px;
                                                            flex-wrap:wrap;
                                                            margin-top:9px;
                                                        "
                                                    >

                                                        <span>
                                                            ✂️
                                                            ${serviceName}
                                                        </span>

                                                        <span class="muted">
                                                            👤
                                                            ${professionalName}
                                                        </span>

                                                        <span class="muted">
                                                            💰
                                                            ${price}
                                                        </span>

                                                    </div>


                                                    ${
                                                        !cancelled
                                                            ? `

                                                                <div
                                                                    style="
                                                                        display:flex;
                                                                        gap:7px;
                                                                        flex-wrap:wrap;
                                                                        margin-top:11px;
                                                                    "
                                                                >

                                                                    ${
                                                                        booking.status !==
                                                                            'completed'
                                                                            ? `

                                                                                <button
                                                                                    type="button"
                                                                                    data-status-booking="${booking.id}"
                                                                                    data-status="completed"
                                                                                >
                                                                                    Concluir
                                                                                </button>

                                                                            `
                                                                            : ''
                                                                    }


                                                                    <button
                                                                        type="button"
                                                                        class="danger"
                                                                        data-cancel="${booking.id}"
                                                                    >
                                                                        Cancelar
                                                                    </button>


                                                                    ${
                                                                        phone
                                                                            ? `

                                                                                <button
                                                                                    type="button"
                                                                                    data-wa="${digits(phone)}"
                                                                                    data-msg="${encodeURIComponent(
                                                                                        'Olá ' +
                                                                                        clientName +
                                                                                        '! Seu agendamento na DNH Barbearia é dia ' +
                                                                                        formatDate(
                                                                                            booking.booking_date
                                                                                        ) +
                                                                                        ' às ' +
                                                                                        time +
                                                                                        '.'
                                                                                    )}"
                                                                                >
                                                                                    WhatsApp
                                                                                </button>

                                                                            `
                                                                            : ''
                                                                    }

                                                                </div>

                                                            `
                                                            : ''
                                                    }

                                                </div>

                                            </div>

                                        `;

                                    }
                                )
                                .join('');


                        return `

                            <section
                                style="
                                    border:1px solid rgba(128,128,128,.22);
                                    border-radius:14px;
                                    overflow:hidden;
                                "
                            >

                                <!-- CABEÇALHO DO DIA -->

                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        align-items:center;
                                        gap:12px;
                                        flex-wrap:wrap;
                                        padding:14px 16px;
                                        background:rgba(128,128,128,.08);
                                    "
                                >

                                    <div>

                                        <strong
                                            style="
                                                text-transform:capitalize;
                                                font-size:16px;
                                            "
                                        >
                                            ${dayName(date)}
                                        </strong>

                                        <span
                                            class="muted"
                                            style="margin-left:8px;"
                                        >
                                            ${formatDate(date)}
                                        </span>

                                    </div>


                                    <span class="muted">
                                        ${dayBookings.length}
                                        agendamento(s)
                                    </span>

                                </div>


                                <!-- HORÁRIOS -->

                                <div>
                                    ${cards}
                                </div>

                            </section>

                        `;

                    }
                )
                .join('');

        }


        /* =====================================================
           FILTROS
           ===================================================== */

        if (dateInput) {

            dateInput.addEventListener(
                'change',
                carregarAgendaAdmin
            );

        }


        if (professionalInput) {

            professionalInput.addEventListener(
                'change',
                carregarAgendaAdmin
            );

        }


        if (clearButton) {

            clearButton.addEventListener(
                'click',
                async () => {

                    if (dateInput) {
                        dateInput.value = '';
                    }


                    if (professionalInput) {
                        professionalInput.value = '';
                    }


                    await carregarAgendaAdmin();

                }
            );

        }


        await carregarAgendaAdmin();

        return;
    }


    /* =========================================================
       CLIENTE
       ========================================================= */

    const clientAgenda = $('#clientAgenda');
    const adminAgenda = $('#adminAgenda');

    if (clientAgenda) {
        clientAgenda.classList.remove('hidden');
    }

    if (adminAgenda) {
        adminAgenda.classList.add('hidden');
    }

    await loadSettings();
    await loadServices();
    await loadProfessionals();
    initClientBooking();
    await loadClientTimes();

    return;


    /* Código legado de agenda do cliente mantido abaixo para preservar a versão original. */

    await loadSettings();

    await loadProfessionals();


    const date =
        $('#agendaDate')?.value ||
        today();


    if ($('#agendaDate')) {

        $('#agendaDate').value =
            date;

    }


    const professionalId =
        $('#agendaProfessional')?.value ||
        '';


    let query =
        sb
            .from('bookings')
            .select(`
                id,
                booking_time,
                status,
                professional_id,
                service_id,
                user_id
            `)
            .eq(
                'booking_date',
                date
            )
            .order(
                'booking_time'
            );


    if (professionalId) {

        query =
            query.eq(
                'professional_id',
                professionalId
            );

    }


    const {
        data: bookings = [],
        error
    } = await query;


    if (error) {

        console.error(
            'Erro ao carregar agenda:',
            error
        );


        if ($('#agendaGrid')) {

            $('#agendaGrid').innerHTML =
                '<p class="muted">Não foi possível carregar a agenda.</p>';

        }

        return;
    }


    const serviceIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.service_id
                    )
                    .filter(Boolean)
            )
        ];


    let serviceMap =
        new Map();


    if (serviceIds.length) {

        const {
            data: serviceData = []
        } = await sb
            .from('services')
            .select(
                'id,name,duration,price'
            )
            .in(
                'id',
                serviceIds
            );


        serviceMap = new Map(
            serviceData.map(s => [s.id, s])
        );
        // Fallback para manter os dados mesmo se uma policy de leitura
        // devolver a lista de serviços vazia nesta consulta.
        services.forEach(s => { if (!serviceMap.has(s.id)) serviceMap.set(s.id, s); });
    }


    const userIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.user_id
                    )
                    .filter(Boolean)
            )
        ];


    let profileMap =
        new Map();


    if (userIds.length) {

        const {
            data: profileData = []
        } = await sb
            .from('profiles')
            .select(
                'id,name,phone'
            )
            .in(
                'id',
                userIds
            );


        profileMap =
            new Map(
                profileData.map(
                    p => [
                        p.id,
                        p
                    ]
                )
            );
    }


    const bookingsByStart =
        new Map();


    bookings.forEach(b => {

        if (!b.booking_time) {
            return;
        }


        const start =
            b.booking_time.slice(
                0,
                5
            );


        bookingsByStart.set(
            start,
            b
        );

    });


    function statusInfo(status) {

        switch (status) {

            case 'in_progress':

                return {
                    text: 'Em atendimento',
                    className: 'progress'
                };


            case 'completed':

                return {
                    text: 'Concluído',
                    className: 'ok'
                };


            case 'cancelled':

                return {
                    text: 'Cancelado',
                    className: 'cancel'
                };


            default:

                return {
                    text: 'Confirmado',
                    className: 'ok'
                };
        }
    }


    const schedule =
        slots();


    if (!$('#agendaGrid')) {
        return;
    }


    $('#agendaGrid').innerHTML =
        schedule.map(time => {

            const booking =
                bookingsByStart.get(
                    time
                );


            if (!booking) {

                const current =
                    timeToMinutes(time);


                const occupying =
                    bookings.find(b => {

                        if (
                            !b.booking_time ||
                            b.status ===
                                'cancelled'
                        ) {

                            return false;
                        }


                        const start =
                            timeToMinutes(
                                b.booking_time
                                    .slice(0, 5)
                            );


                        const service =
                            serviceMap.get(
                                b.service_id
                            );


                        const duration =
                            Number(
                                service?.duration
                            ) || 30;


                        const end =
                            start +
                            duration;


                        return (
                            current >
                                start &&
                            current <
                                end
                        );
                    });


                if (occupying) {

                    const service =
                        serviceMap.get(
                            occupying.service_id
                        );


                    return `

                        <div class="slot-card busy">

                            <div class="time">
                                ${time}
                            </div>

                            <div class="client">

                                <small>
                                    Horário ocupado
                                </small>

                                <b>
                                    ${
                                        service?.name ||
                                        'Serviço'
                                    }
                                </b>

                            </div>

                        </div>

                    `;
                }


                return `

                    <div class="slot-card">

                        <div class="time">
                            ${time}
                        </div>

                        <small class="muted">
                            Livre
                        </small>

                    </div>

                `;
            }


            const service =
                serviceMap.get(
                    booking.service_id
                );


            const client =
                profileMap.get(
                    booking.user_id
                );


            const info =
                statusInfo(
                    booking.status
                );


            const serviceName =
                service?.name ||
                'Serviço';


            const duration =
                Number(
                    service?.duration
                ) || 30;


            const price =
                money(
                    service?.price
                );


            const clientName =
                client?.name ||
                'Cliente';


            const phone =
                client?.phone ||
                '';


            const isCancelled =
                booking.status ===
                'cancelled';


            return `

                <div
                    class="slot-card busy"
                    style="
                        border-left:4px solid currentColor;
                    "
                >

                    <div class="time">

                        ${time}

                        <small>
                            ${duration} min
                        </small>

                    </div>


                    <div class="client">

                        <b>
                            ${clientName}
                        </b>

                        <small>
                            ${serviceName}
                        </small>

                        <small>
                            ${price}
                        </small>

                        ${
                            phone
                                ? `
                                    <small>
                                        📱 ${phone}
                                    </small>
                                `
                                : ''
                        }

                    </div>


                    <div
                        style="
                            margin-top:8px;
                            display:flex;
                            align-items:center;
                            gap:8px;
                            flex-wrap:wrap;
                        "
                    >

                        <span
                            class="${info.className}"
                        >
                            ${info.text}
                        </span>

                    </div>


                    ${
                        !isCancelled
                            ? `

                        <div
                            class="slot-actions"
                            style="
                                display:flex;
                                gap:6px;
                                flex-wrap:wrap;
                                margin-top:10px;
                            "
                        >

                            ${
                                booking.status !==
                                    'in_progress' &&
                                booking.status !==
                                    'completed'
                                    ? `

                                        <button
                                            type="button"
                                            data-status-booking="${booking.id}"
                                            data-status="in_progress"
                                        >
                                            Iniciar
                                        </button>

                                    `
                                    : ''
                            }


                            ${
                                booking.status !==
                                    'completed'
                                    ? `

                                        <button
                                            type="button"
                                            data-status-booking="${booking.id}"
                                            data-status="completed"
                                        >
                                            Concluir
                                        </button>

                                    `
                                    : ''
                            }


                            <button
                                type="button"
                                class="danger"
                                data-cancel="${booking.id}"
                            >
                                Cancelar
                            </button>


                            ${
                                phone
                                    ? `

                                        <button
                                            type="button"
                                            data-wa="${digits(phone)}"
                                            data-msg="${encodeURIComponent(
                                                'Olá ' +
                                                clientName +
                                                '! Seu agendamento na DNH Barbearia é hoje às ' +
                                                time +
                                                '.'
                                            )}"
                                        >
                                            WhatsApp
                                        </button>

                                    `
                                    : ''
                            }

                        </div>

                    `
                            : ''
                    }

                </div>

            `;

        }).join('');
}


/* =========================================================
   CLIENTE - INICIALIZAÇÃO
   ========================================================= */

function initClientBooking() {

    const date =
        $('#clientDate');


    if (!date) {
        return;
    }


    date.value =
        today();


    date.min =
        today();
}


/* =========================================================
   CLIENTE - HORÁRIOS DISPONÍVEIS
   ========================================================= */

async function loadClientTimes() {

    const serviceId = $('#clientService')?.value;
    const professionalId = $('#clientProfessional')?.value;
    const date = $('#clientDate')?.value;
    const grid = $('#clientTimeGrid');

    if (!grid) return;

    atualizarResumoAgendamento('');

    if (!serviceId || !professionalId || !date) {
        grid.innerHTML = '<p class="muted">Selecione serviço, profissional e data.</p>';
        return;
    }

    const service = services.find(s => s.id === serviceId);
    if (!service) {
        grid.innerHTML = '<p class="muted">Serviço não encontrado.</p>';
        return;
    }

    const duration = Number(service.duration) || 30;
    const daySchedule = scheduleForDate(date);

    if (daySchedule.enabled === false) {
        grid.innerHTML = '<p class="muted"><b>Não há atendimento nesta data.</b> A barbearia não atende neste dia.</p>';
        return;
    }

    const opening = timeToMinutes(String(daySchedule.start || settings.start_time || '08:00').slice(0, 5));
    const closing = timeToMinutes(String(daySchedule.end || settings.end_time || '18:00').slice(0, 5));
    const interval = Number(settings.slot_interval) || 30;

    if (!Number.isFinite(opening) || !Number.isFinite(closing) || closing <= opening) {
        grid.innerHTML = '<p class="muted">Horário de atendimento configurado incorretamente.</p>';
        return;
    }

    const { data: bookings = [], error } = await sb
        .from('bookings')
        .select('booking_time,status,service_id')
        .eq('professional_id', professionalId)
        .eq('booking_date', date)
        .neq('status', 'cancelled');

    if (error) {
        console.error('Erro ao carregar horários:', error);
        grid.innerHTML = '<p class="muted">Não foi possível carregar os horários.</p>';
        return;
    }

    const occupied = bookings
        .filter(b => b.booking_time)
        .map(b => {
            const start = timeToMinutes(String(b.booking_time).slice(0, 5));
            const bookedService = services.find(s => s.id === b.service_id);
            const bookedDuration = Number(bookedService?.duration) || 30;
            return { start, end: start + bookedDuration };
        })
        .filter(b => Number.isFinite(b.start));

    const available = [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let start = opening; start + duration <= closing; start += interval) {
        if (date === today() && start <= currentMinutes) continue;

        const end = start + duration;
        const lunchStart = timeToMinutes(String(daySchedule.lunch_start || '').slice(0, 5));
        const lunchEnd = timeToMinutes(String(daySchedule.lunch_end || '').slice(0, 5));
        const inLunch = Number.isFinite(lunchStart) && Number.isFinite(lunchEnd) && lunchEnd > lunchStart && start < lunchEnd && end > lunchStart;
        if (inLunch) continue;
        const conflict = occupied.some(booked => start < booked.end && end > booked.start);
        if (conflict) continue;

        const hh = String(Math.floor(start / 60)).padStart(2, '0');
        const mm = String(start % 60).padStart(2, '0');
        available.push(`${hh}:${mm}`);
    }

    if (!available.length) {
        grid.innerHTML = '<p class="muted">Nenhum horário disponível para esta data.</p>';
        return;
    }

    grid.innerHTML = available.map(time => `
        <button type="button" class="time-option" data-booking-time="${time}">${time}</button>
    `).join('');
}

/* =========================================================
   CLIENTE - RESUMO
   ========================================================= */

function atualizarResumoAgendamento(time) {

    const service =
        services.find(
            s =>
                s.id ===
                $('#clientService')?.value
        );


    const professional =
        professionals.find(
            p =>
                p.id ===
                $('#clientProfessional')?.value
        );


    if ($('#summaryService')) {

        $('#summaryService').textContent =
            service?.name ||
            '-';

    }


    if ($('#summaryProfessional')) {

        $('#summaryProfessional').textContent =
            professional?.name ||
            '-';

    }


    if ($('#summaryDate')) {

        const date =
            $('#clientDate')?.value;


        if (date) {

            const [
                year,
                month,
                day
            ] =
                date.split('-');


            $('#summaryDate').textContent =
                `${day}/${month}/${year}`;

        } else {

            $('#summaryDate').textContent =
                '-';

        }
    }


    if ($('#summaryTime')) {

        $('#summaryTime').textContent =
            time ||
            '';

    }


    if ($('#bookingSummary')) {

        if (time) {

            $('#bookingSummary')
                .classList
                .remove('hidden');

        } else {

            $('#bookingSummary')
                .classList
                .add('hidden');

        }
    }
}


/* =========================================================
   CLIENTE - CRIAR AGENDAMENTO
   ========================================================= */

async function createBooking() {

    if (!isClient()) {

        toast(
            'Somente clientes podem realizar este agendamento.'
        );

        return;
    }


    const serviceId =
        $('#clientService')?.value;


    const professionalId =
        $('#clientProfessional')?.value;


    const date =
        $('#clientDate')?.value;


    const time =
        $('#summaryTime')?.textContent?.trim();


    if (!serviceId || !professionalId || !date || !time) {
        alert('Selecione serviço, profissional, data e horário antes de confirmar o agendamento.');
        return;
    }

    const daySchedule = scheduleForDate(date);
    if (daySchedule.enabled === false) {
        alert('A barbearia não atende nesta data. Escolha outro dia.');
        await loadClientTimes();
        return;
    }

    const selectedMinutes = timeToMinutes(time);
    const opening = timeToMinutes(String(daySchedule.start || settings.start_time).slice(0, 5));
    const closing = timeToMinutes(String(daySchedule.end || settings.end_time).slice(0, 5));
    const selectedService = services.find(s => s.id === serviceId);
    const duration = Number(selectedService?.duration) || 30;

    if (selectedMinutes < opening || selectedMinutes + duration > closing) {
        alert('O horário escolhido está fora do horário de atendimento configurado para este dia.');
        await loadClientTimes();
        return;
    }

    const lunchStart = timeToMinutes(String(daySchedule.lunch_start || '').slice(0, 5));
    const lunchEnd = timeToMinutes(String(daySchedule.lunch_end || '').slice(0, 5));
    if (Number.isFinite(lunchStart) && Number.isFinite(lunchEnd) && lunchEnd > lunchStart && selectedMinutes < lunchEnd && selectedMinutes + duration > lunchStart) {
        alert('O horário escolhido está dentro do intervalo reservado para almoço. Escolha outro horário.');
        await loadClientTimes();
        return;
    }


    const {
        data: {
            user: authUser
        }
    } =
        await sb.auth.getUser();


    if (!authUser) {

        toast(
            'Faça login para realizar o agendamento.'
        );

        return;
    }


    const {
        data: existing,
        error: checkError
    } = await sb
        .from('bookings')
        .select('id')
        .eq(
            'professional_id',
            professionalId
        )
        .eq(
            'booking_date',
            date
        )
        .eq(
            'booking_time',
            time + ':00'
        )
        .neq(
            'status',
            'cancelled'
        )
        .limit(1)
        .maybeSingle();


    if (checkError) {

        console.error(
            'Erro ao verificar horário:',
            checkError
        );


        toast(
            'Não foi possível verificar o horário.'
        );

        return;
    }


    if (existing) {

        toast(
            'Esse horário acabou de ser ocupado. Escolha outro.'
        );


        await loadClientTimes();

        return;
    }


    const {
        error
    } = await sb
        .from('bookings')
        .insert({

            user_id:
                authUser.id,

            service_id:
                serviceId,

            professional_id:
                professionalId,

            booking_date:
                date,

            booking_time:
                time + ':00',

            status:
                'confirmed',

            notes:
                null

        });


    if (error) {

        console.error(
            'Erro ao criar agendamento:',
            error
        );


        if (
            error.code ===
            '23505'
        ) {

            toast(
                'Este horário acabou de ser reservado por outro cliente. Escolha outro horário.'
            );


            await loadClientTimes();

            return;
        }


        toast(
            error.message ||
            'Não foi possível realizar o agendamento.'
        );

        return;
    }


    toast(
        'Agendamento confirmado!'
    );


    if ($('#bookingSummary')) {

        $('#bookingSummary')
            .classList
            .add('hidden');

    }


    if ($('#clientService')) {

        $('#clientService').value =
            '';

    }


    if ($('#clientProfessional')) {

        $('#clientProfessional').value =
            '';

    }


    if ($('#clientTimeGrid')) {

        $('#clientTimeGrid').innerHTML =
            '<p class="muted">Selecione serviço, profissional e data.</p>';

    }


    if ($('#summaryTime')) {

        $('#summaryTime').textContent =
            '';

    }


    await consultarAgenda();
}


/* =========================================================
   CLIENTE - CONSULTAR AGENDAMENTOS
   ========================================================= */

async function consultarAgenda() {

    const list =
        $('#clientBookingsList');


    if (!list) {
        return;
    }


    list.innerHTML =
        '<p class="muted">Carregando seus agendamentos...</p>';


    const {
        data: {
            user: authUser
        },
        error: authError
    } =
        await sb.auth.getUser();


    if (
        authError ||
        !authUser
    ) {

        console.error(
            'Erro ao obter usuário:',
            authError
        );


        list.innerHTML =
            '<p class="muted">Faça login para consultar seus agendamentos.</p>';

        return;
    }


    const {
        data: bookings = [],
        error
    } = await sb
        .from('bookings')
        .select(`
            id,
            booking_date,
            booking_time,
            status,
            service_id,
            professional_id,
            notes
        `)
        .eq(
            'user_id',
            authUser.id
        )
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });


    if (error) {

        console.error(
            'Erro ao consultar agendamentos:',
            error
        );


        list.innerHTML = `

            <div class="empty-state">

                <p>
                    Não foi possível carregar seus agendamentos.
                </p>

                <small class="muted">
                    ${error.message || ''}
                </small>

            </div>

        `;

        return;
    }


    if (!bookings.length) {

        list.innerHTML = `

            <div class="empty-state">

                <p>
                    Você ainda não possui agendamentos.
                </p>

            </div>

        `;

        return;
    }


    const serviceIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.service_id
                    )
                    .filter(Boolean)
            )
        ];


    let serviceMap =
        new Map();


    if (serviceIds.length) {

        const {
            data: serviceData = []
        } = await sb
            .from('services')
            .select(
                'id,name,duration,price'
            )
            .in(
                'id',
                serviceIds
            );


        serviceMap =
            new Map(
                serviceData.map(
                    s => [
                        s.id,
                        s
                    ]
                )
            );
    }


    const professionalIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.professional_id
                    )
                    .filter(Boolean)
            )
        ];


    let professionalMap =
        new Map();


    if (professionalIds.length) {

        const {
            data: professionalData = []
        } = await sb
            .from('professionals')
            .select(
                'id,name'
            )
            .in(
                'id',
                professionalIds
            );


        professionalMap = new Map(
            professionalData.map(p => [p.id, p])
        );
        professionals.forEach(p => { if (!professionalMap.has(p.id)) professionalMap.set(p.id, p); });
    }


    function statusInfo(status) {

        switch (status) {

            case 'confirmed':

                return {
                    text: 'Confirmado',
                    className: 'ok'
                };


            case 'in_progress':

                return {
                    text: 'Em atendimento',
                    className: 'progress'
                };


            case 'completed':

                return {
                    text: 'Concluído',
                    className: 'ok'
                };


            case 'cancelled':

                return {
                    text: 'Cancelado',
                    className: 'cancel'
                };


            default:

                return {
                    text:
                        status ||
                        'Confirmado',
                    className: ''
                };
        }
    }


    function formatDate(date) {

        if (!date) {
            return '';
        }


        const [
            year,
            month,
            day
        ] =
            date.split('-');


        return `${day}/${month}/${year}`;
    }


    list.innerHTML =
        bookings.map(b => {

            const service =
                serviceMap.get(
                    b.service_id
                );


            const professional =
                professionalMap.get(
                    b.professional_id
                );


            const serviceName =
                service?.name ||
                'Serviço';


            const duration =
                Number(
                    service?.duration
                ) || 30;


            const price =
                money(
                    service?.price ||
                    0
                );


            const professionalName =
                professional?.name ||
                'Profissional';


            const time =
                b.booking_time
                    ? b.booking_time.slice(
                        0,
                        5
                    )
                    : '';


            const status =
                statusInfo(
                    b.status
                );


            const cancelButton =
                b.status !==
                    'cancelled' &&
                b.status !==
                    'completed'

                    ? `

                        <button
                            type="button"
                            class="danger"
                            data-client-cancel="${b.id}"
                        >
                            Cancelar agendamento
                        </button>

                    `

                    : '';


            return `

                <div class="booking-card">

                    <div class="booking-main">

                        <div class="booking-date">

                            <strong>
                                ${formatDate(
                                    b.booking_date
                                )}
                            </strong>

                            <span>
                                ${time}
                            </span>

                        </div>


                        <div class="booking-info">

                            <strong>
                                ${serviceName}
                            </strong>

                            <small>
                                Profissional:
                                ${professionalName}
                            </small>

                            <small>
                                Duração:
                                ${duration} min
                            </small>

                            <small>
                                Valor:
                                ${price}
                            </small>

                        </div>

                    </div>


                    <div class="booking-footer">

                        <span
                            class="${status.className}"
                        >
                            ${status.text}
                        </span>

                        ${cancelButton}

                    </div>

                </div>

            `;

        }).join('');
}


/* =========================================================
   CANCELAR AGENDAMENTO DO CLIENTE
   ========================================================= */

async function cancelarMeuAgendamento(
    bookingId
) {

    if (!isClient()) {

        toast(
            'Acesso não permitido.'
        );

        return;
    }


    const {
        data: {
            user: authUser
        }
    } =
        await sb.auth.getUser();


    if (!authUser) {

        toast(
            'Faça login novamente.'
        );

        return;
    }


    const confirmar =
        confirm(
            'Deseja realmente cancelar este agendamento?'
        );


    if (!confirmar) {
        return;
    }


    const {
        error
    } = await sb
        .from('bookings')
        .update({
            status:
                'cancelled'
        })
        .eq(
            'id',
            bookingId
        )
        .eq(
            'user_id',
            authUser.id
        );


    if (error) {

        console.error(
            'Erro ao cancelar agendamento:',
            error
        );


        toast(
            'Não foi possível cancelar o agendamento.'
        );

        return;
    }


    toast(
        'Agendamento cancelado com sucesso!'
    );


    await consultarAgenda();
}


/* =========================================================
   CLIENTES ADMIN
   ========================================================= */

async function excluirCliente(clientId) {
    if (!isAdmin()) return;
    const client = (window.allClients || []).find(c => String(c.id) === String(clientId));
    if (!client) { toast('Cliente não encontrado.'); return; }
    if (!confirm(`Excluir o cliente "${client.name || client.email || 'Cliente'}"? Esta ação removerá também os agendamentos dele.`)) return;

    const { data: bookings = [], error: bookingError } = await sb.from('bookings').select('id').eq('user_id', clientId);
    if (bookingError) { console.error('Erro ao verificar agendamentos do cliente:', bookingError); toast('Não foi possível verificar os agendamentos do cliente.'); return; }

    if (bookings.length) {
        const { error } = await sb.from('bookings').delete().eq('user_id', clientId);
        if (error) { console.error('Erro ao excluir agendamentos do cliente:', error); toast(error.message || 'Não foi possível excluir os agendamentos do cliente.'); return; }
    }

    const { error } = await sb.from('profiles').delete().eq('id', clientId).eq('role','client');
    if (error) { console.error('Erro ao excluir cliente:', error); toast(error.message || 'Não foi possível excluir o cliente.'); showActionMessage('Não foi possível excluir o cliente.', 'error'); return; }
    toast('Cliente excluído com sucesso.');
    showActionMessage('Cliente excluído com sucesso.');
    await loadClients();
}

async function loadClients() {

    if (!isAdmin()) {
        return;
    }


    const {
        data = [],
        error
    } = await sb
        .from('profiles')
        .select('*')
        .eq(
            'role',
            'client'
        )
        .order(
            'name'
        );


    if (error) {

        console.error(
            'Erro ao carregar clientes:',
            error
        );

        return;
    }


    window.allClients =
        data || [];


    renderClients(
        data || []
    );
}


function renderClients(data) {
    if (!isAdmin() || !$('#clientList')) return;
    if (!data || !data.length) {
        $('#clientList').innerHTML = '<p class="muted">Nenhum cliente cadastrado.</p>';
        return;
    }
    $('#clientList').innerHTML = `
        <div style="overflow-x:auto;width:100%;">
            <table class="table">
                <thead><tr><th>Nome</th><th>WhatsApp</th><th>Nascimento</th><th>E-mail</th><th>Ações</th></tr></thead>
                <tbody>
                    ${data.map(c => `
                        <tr>
                            <td>${c.name || '-'}</td>
                            <td>${c.phone || '-'}</td>
                            <td>${c.birth ? new Date(c.birth + 'T12:00').toLocaleDateString('pt-BR') : '-'}</td>
                            <td>${c.email || '-'}</td>
                            <td>
                                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                    <button type="button" data-client-edit="${c.id}">Editar</button>
                                    <button type="button" data-client-bookings="${c.id}">Agendamentos</button>
                                    <button type="button" class="danger" data-client-delete="${c.id}">Excluir</button>
                                </div>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}


/* =========================================================
   ESTOQUE
   ========================================================= */

async function loadStock() {
    if (!isAdmin()) return;
    const { data = [], error } = await sb.from('inventory').select('*').order('name');
    if (error) { console.error('Erro ao carregar estoque:', error); toast('Não foi possível carregar o estoque.'); return; }
    const list = $('#stockList');
    if (!list) return;
    const lowItems = data.filter(x => Number(x.quantity) <= Number(x.min_quantity));
    const alertBox = $('#stockAlert');
    if (alertBox) {
        alertBox.classList.toggle('hidden', lowItems.length === 0);
        alertBox.innerHTML = lowItems.length ? `<b>⚠ Atenção:</b> ${lowItems.length} produto(s) no estoque mínimo ou abaixo.` : '';
    }
    list.innerHTML = data.length ? data.map(x => {
        const low = Number(x.quantity) <= Number(x.min_quantity);
        return `<div class="list-row"><div><b>${escapeHtml(x.name)}</b><small>Saldo: ${x.quantity} • mínimo: ${x.min_quantity}</small></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><span class="${low?'cancel':'ok'}">${low?'⚠ Estoque baixo':'OK'}</span><button type="button" data-stock-entry="${x.id}">+ Entrada</button><button type="button" data-stock-exit="${x.id}">− Saída</button><button type="button" class="danger" data-stock-delete="${x.id}">Excluir</button></div></div>`;
    }).join('') : '<p class="muted">Nenhum produto cadastrado.</p>';
}

async function registrarMovimentoEstoque(id, tipo) {
    if (!isAdmin()) return;
    const { data: item, error } = await sb.from('inventory').select('*').eq('id', id).maybeSingle();
    if (error || !item) { toast('Produto não encontrado.'); return; }
    const raw = prompt(`${tipo === 'in' ? 'Quantidade de ENTRADA' : 'Quantidade de SAÍDA'} para ${item.name}:`);
    const qty = Number(String(raw || '').replace(',','.'));
    if (!Number.isFinite(qty) || qty <= 0) { toast('Informe uma quantidade válida.'); return; }
    const current = Number(item.quantity) || 0;
    if (tipo === 'out' && qty > current) { toast('A saída não pode ser maior que o estoque atual.'); return; }
    const next = tipo === 'in' ? current + qty : current - qty;
    const { error: moveError } = await sb.from('inventory_movements').insert({ inventory_id:id, type:tipo, quantity:qty });
    if (moveError) { console.error('Erro ao registrar movimento:', moveError); toast(moveError.message || 'Não foi possível registrar a movimentação.'); return; }
    const { error: updateError } = await sb.from('inventory').update({quantity:next,updated_at:new Date().toISOString()}).eq('id',id);
    if (updateError) { console.error('Erro ao atualizar estoque:', updateError); toast(updateError.message || 'Não foi possível atualizar o estoque.'); return; }
    toast(tipo === 'in' ? 'Entrada registrada.' : 'Saída registrada.');
    await loadStock();
}


/* =========================================================
   FINANCEIRO
   ========================================================= */

function updateFinanceMonthControl() {
    const filter = $('#financePeriod')?.value || 'month';
    const wrap = $('#financeMonthWrap');
    if (wrap) wrap.style.display = filter === 'month' ? '' : 'none';
}


async function loadFinance() {
    if (!isAdmin()) return;

    const filter = $('#financePeriod')?.value || 'month';
    const monthInput = $('#financeMonth');
    const selectedMonth = monthInput?.value || today().slice(0, 7);
    let from;
    let to;

    if (filter === 'day') {
        from = to = today();
    } else if (filter === 'week') {
        const reference = new Date();
        const day = reference.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(reference);
        monday.setDate(reference.getDate() + diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        from = toDateInputValue(monday);
        to = toDateInputValue(sunday);
    } else {
        const [year, month] = selectedMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        from = `${selectedMonth}-01`;
        to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    }

    const { data = [], error } = await sb
        .from('cash_entries')
        .select('*')
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar financeiro:', error);
        toast('Não foi possível carregar o financeiro.');
        return;
    }

    const income = data.filter(x => x.type === 'income').reduce((a, x) => a + Number(x.amount || 0), 0);
    const expense = data.filter(x => x.type === 'expense').reduce((a, x) => a + Number(x.amount || 0), 0);

    if ($('#sumIncome')) $('#sumIncome').textContent = money(income);
    if ($('#sumExpense')) $('#sumExpense').textContent = money(expense);
    if ($('#sumBalance')) $('#sumBalance').textContent = money(income - expense);

    if ($('#financeList')) {
        $('#financeList').innerHTML = data.length
            ? data.slice(0, 50).map(x => `
                <div class="list-row">
                    <div>
                        <b>${escapeHtml(x.description || 'Lançamento')}</b>
                        <small>${new Date(x.entry_date + 'T12:00').toLocaleDateString('pt-BR')} • ${x.booking_id ? 'Sistema' : 'Manual'}</small>
                    </div>
                    <span class="${x.type === 'income' ? 'ok' : 'cancel'}">${x.type === 'income' ? '+' : '-'} ${money(x.amount)}</span>
                </div>
            `).join('')
            : '<p class="muted">Nenhum lançamento no período.</p>';
    }

    renderFinanceChart(data, from, to);

    if ($('#financePeriod')) {
        $('#financePeriod').onchange = async () => {
            updateFinanceMonthControl();
            await loadFinance();
        };
    }
    if ($('#financeMonth')) $('#financeMonth').onchange = loadFinance;
    updateFinanceMonthControl();

    if (!$('#financeAllButton')) {
        const btn = document.createElement('button');
        btn.id = 'financeAllButton';
        btn.type = 'button';
        btn.className = 'btn secondary';
        btn.textContent = 'Ver todos os lançamentos';
        btn.style.marginTop = '12px';
        $('#financeList')?.parentElement?.appendChild(btn);
        btn.addEventListener('click', abrirTodosFinanceiros);
    }
}

function toDateInputValue(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function renderFinanceChart(data, from, to) {
    const box=$('#financeChart'); if(!box) return;
    const map={}; data.forEach(x=>{ const k=x.entry_date; map[k]=(map[k]||0)+(x.type==='income'?1:-1)*Number(x.amount||0); });
    const keys=Object.keys(map).sort(); const max=Math.max(1,...keys.map(k=>Math.abs(map[k])));
    box.innerHTML=keys.length?keys.map(k=>{const v=map[k]; const width=Math.max(4,Math.round(Math.abs(v)/max*100)); return `<div style="display:grid;grid-template-columns:90px 1fr 110px;gap:8px;align-items:center;margin:7px 0;"><small>${new Date(k+'T12:00').toLocaleDateString('pt-BR')}</small><div style="background:rgba(128,128,128,.15);border-radius:6px;overflow:hidden;height:14px;"><div style="width:${width}%;height:100%;background:${v>=0?'#2eaf6d':'#d9534f'};"></div></div><small style="text-align:right;">${money(v)}</small></div>`}).join(''):'<p class="muted">Sem dados para o gráfico.</p>';
}


async function abrirTodosFinanceiros() {
    if (!isAdmin()) return;
    const { data = [], error } = await sb.from('cash_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) {
        console.error('Erro ao carregar todos os lançamentos:', error);
        toast('Não foi possível carregar todos os lançamentos.');
        return;
    }
    const old = $('#allFinanceModal');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'allFinanceModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    modal.innerHTML = `
        <div style="width:min(900px,100%);max-height:90vh;overflow:auto;background:var(--card,#151515);border-radius:18px;padding:22px;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
                <div><span class="eyebrow">FINANCEIRO</span><h2 style="margin:4px 0 0;">Todos os lançamentos</h2></div>
                <button type="button" id="closeAllFinance">✕</button>
            </div>
            <div style="display:grid;gap:8px;">
                ${data.length ? data.map(x => `
                    <div class="list-row" style="gap:12px;">
                        <div style="flex:1;min-width:180px;">
                            <b>${x.description || 'Lançamento'}</b>
                            <small>${new Date(x.entry_date + 'T12:00').toLocaleDateString('pt-BR')} • ${x.booking_id ? 'Sistema / Agendamento' : 'Manual'}</small>
                        </div>
                        <span class="${x.type === 'income' ? 'ok' : 'cancel'}">${x.type === 'income' ? '+' : '-'} ${money(x.amount)}</span>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            <button type="button" data-finance-edit="${x.id}">Editar</button>
                            <button type="button" class="danger" data-finance-delete="${x.id}">Excluir</button>
                        </div>
                    </div>
                `).join('') : '<p class="muted">Nenhum lançamento cadastrado.</p>'}
            </div>
        </div>`;
    document.body.appendChild(modal);
    $('#closeAllFinance')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function editarLancamentoFinanceiro(id) {
    if (!isAdmin()) return;
    const { data: item, error: fetchError } = await sb.from('cash_entries').select('*').eq('id', id).maybeSingle();
    if (fetchError || !item) { toast('Lançamento não encontrado.'); return; }
    const type = prompt('Tipo: income para Entrada ou expense para Saída:', item.type || 'income');
    if (type === null) return;
    if (!['income','expense'].includes(type)) { toast('Tipo inválido. Use income ou expense.'); return; }
    const description = prompt('Descrição:', item.description || '');
    if (description === null) return;
    const amountText = prompt('Valor:', String(item.amount ?? 0).replace('.', ','));
    if (amountText === null) return;
    const amount = Number(String(amountText).replace(',', '.'));
    const entryDate = prompt('Data (AAAA-MM-DD):', item.entry_date || today());
    if (entryDate === null) return;
    if (!Number.isFinite(amount) || amount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) { toast('Valor ou data inválidos.'); return; }
    const { error } = await sb.from('cash_entries').update({ type, description: description.trim(), amount, entry_date: entryDate }).eq('id', id);
    if (error) { console.error('Erro ao editar lançamento:', error); toast(error.message || 'Não foi possível editar.'); return; }
    toast('Lançamento atualizado.');
    await loadFinance();
    await abrirTodosFinanceiros();
}

async function excluirLancamentoFinanceiro(id) {
    if (!isAdmin()) return;
    if (!confirm('Excluir este lançamento financeiro?')) return;
    const { error } = await sb.from('cash_entries').delete().eq('id', id);
    if (error) { console.error('Erro ao excluir lançamento:', error); toast(error.message || 'Não foi possível excluir.'); return; }
    toast('Lançamento excluído.');
    await loadFinance();
    await abrirTodosFinanceiros();
}


/* =========================================================
   EQUIPE
   ========================================================= */

async function loadTeam() {
    if (!isAdmin()) return;

    const { data = [], error } = await sb
        .from('professionals')
        .select('*')
        .order('name');

    if (error) {
        console.error('Erro ao carregar equipe:', error);
        toast('Não foi possível carregar a equipe.');
        return;
    }

    if (!$('#teamList')) return;

    $('#teamList').innerHTML = data.length ? data.map(x => {
        const status = x.work_status || (x.active ? 'active' : 'inactive');
        const statusText = status === 'vacation' ? 'Férias' : status === 'inactive' ? 'Inativo' : 'Ativo';
        const statusClass = status === 'active' ? 'ok' : 'cancel';
        return `
            <div class="list-row">
                <div>
                    <b>${x.name || 'Profissional'}</b>
                    <small>${x.phone || ''}</small>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                    <span class="${statusClass}">${statusText}</span>
                    <button type="button" data-team-edit="${x.id}">Editar</button>
                    <button type="button" data-team-vacation="${x.id}">Férias</button>
                    <button type="button" data-team-active="${x.id}">Ativo</button>
                    <button type="button" data-team-inactive="${x.id}">Inativo</button>
                    <button type="button" class="danger" data-team-delete="${x.id}">Excluir</button>
                </div>
            </div>`;
    }).join('') : '<p class="muted">Nenhum profissional.</p>';
}

async function alterarStatusEquipe(professionalId, status) {
    if (!isAdmin()) return;
    const patch = { work_status: status, active: status === 'active' };
    const { error } = await sb.from('professionals').update(patch).eq('id', professionalId);
    if (error) {
        console.error('Erro ao alterar status da equipe:', error);
        toast(error.message || 'Não foi possível alterar o status.');
        showActionMessage('Não foi possível alterar o status.', 'error');
        return;
    }
    const labels = { active: 'Ativo', vacation: 'Férias', inactive: 'Inativo' };
    toast(`Profissional marcado como ${labels[status]}.`);
    showActionMessage(`Status alterado para ${labels[status]}.`);
    await loadProfessionals();
    await loadTeam();
}

async function editarProfissional(professionalId) {
    if (!isAdmin()) return;
    let professional = professionals.find(p => String(p.id) === String(professionalId));
    if (!professional) {
        const { data, error } = await sb.from('professionals').select('*').eq('id', professionalId).maybeSingle();
        if (error || !data) { toast('Profissional não encontrado.'); return; }
        professional = data;
    }
    const name = prompt('Nome do profissional:', professional.name || '');
    if (name === null) return;
    const phone = prompt('Telefone/WhatsApp:', professional.phone || '');
    if (phone === null) return;
    const { error } = await sb.from('professionals').update({ name: name.trim(), phone: phone.trim() }).eq('id', professionalId);
    if (error) {
        console.error('Erro ao editar profissional:', error);
        toast(error.message || 'Não foi possível editar o profissional.');
        return;
    }
    toast('Profissional atualizado.');
    showActionMessage('Profissional atualizado com sucesso.');
    await loadProfessionals();
    await loadTeam();
}

async function excluirProfissional(professionalId) {
    if (!isAdmin()) return;
    let professional = professionals.find(p => String(p.id) === String(professionalId));
    if (!professional) {
        const { data, error } = await sb.from('professionals').select('*').eq('id', professionalId).maybeSingle();
        if (error || !data) { toast('Profissional não encontrado.'); return; }
        professional = data;
    }
    if (!confirm(`Excluir o profissional \"${professional.name || 'Profissional'}\"?`)) return;

    const { count, error: checkError } = await sb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', professionalId);

    if (checkError) {
        console.error('Erro ao verificar agendamentos do profissional:', checkError);
        toast('Não foi possível verificar os agendamentos do profissional.');
        return;
    }
    if (Number(count || 0) > 0) {
        const msg = 'Este profissional possui agendamentos vinculados. Use Inativo ou Férias para preservar o histórico.';
        toast(msg);
        showActionMessage(msg, 'error');
        return;
    }

    const { error } = await sb.from('professionals').delete().eq('id', professionalId);
    if (error) {
        console.error('Erro ao excluir profissional:', error);
        toast(error.message || 'Não foi possível excluir o profissional.');
        showActionMessage('Não foi possível excluir o profissional.', 'error');
        return;
    }
    toast('Profissional excluído com sucesso.');
    showActionMessage('Profissional excluído com sucesso.');
    await loadProfessionals();
    await loadTeam();
}


/* =========================================================
   NOVO AGENDAMENTO ADMINISTRATIVO
   ========================================================= */

$$('[data-admin-new-booking]').forEach(button => {
    button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        if (isAdmin()) await novoAgendamentoAdmin();
    });
});

/* =========================================================
   NAVEGAÇÃO DOS BOTÕES
   ========================================================= */

$$('[data-page]').forEach(button => {

    button.onclick = async event => {

        if (button.hasAttribute('data-admin-new-booking')) {
            event.preventDefault();
            event.stopPropagation();
            if (isAdmin()) {
                await novoAgendamentoAdmin();
            }
            return;
        }

        go(button.dataset.page);

    };

});


/* =========================================================
   TABS LOGIN / CADASTRO
   ========================================================= */

$$('.auth-tabs button').forEach(button => {

    button.onclick = () => {

        $$('.auth-tabs button')
            .forEach(
                x =>
                    x.classList.remove(
                        'active'
                    )
            );


        button.classList.add(
            'active'
        );


        const signup =
            button.dataset.auth ===
            'signup';


        if ($('#loginForm')) {

            $('#loginForm')
                .classList
                .toggle(
                    'hidden',
                    signup
                );

        }


        if ($('#signupForm')) {

            $('#signupForm')
                .classList
                .toggle(
                    'hidden',
                    !signup
                );

        }

    };

});


/* =========================================================
   LOGIN
   ========================================================= */

if ($('#loginForm')) {

    $('#loginForm').onsubmit =
        async e => {

            e.preventDefault();


            const {
                error
            } =
                await sb.auth
                    .signInWithPassword({

                        email:
                            $('#loginEmail')
                                .value
                                .trim(),

                        password:
                            $('#loginPassword')
                                .value

                    });


            if (error) {

                console.error(
                    'ERRO DE LOGIN:',
                    error
                );

                alert(
                    'E-mail ou senha incorretos.'
                );

                return;
            }

        };
}


/* =========================================================
   CADASTRO CLIENTE
   ========================================================= */

if ($('#signupForm')) {

    $('#signupForm').onsubmit =
        async e => {

            e.preventDefault();


            const name =
                $('#signupName')
                    .value
                    .trim();


            const phone =
                $('#signupPhone')
                    .value
                    .trim();


            const email =
                $('#signupEmail')
                    .value
                    .trim();


            const password =
                $('#signupPassword')
                    .value;


            const birth =
                $('#signupBirth')
                    .value ||
                null;


            if (
                !name ||
                !phone ||
                !email ||
                !password
            ) {

                toast(
                    'Preencha todos os campos obrigatórios.'
                );

                return;
            }


            const {
                data,
                error
            } =
                await sb.auth.signUp({

                    email,

                    password,

                    options: {

                        data: {
                            name,
                            phone,
                            birth
                        }

                    }

                });


            if (error) {

                const msg =
                    (
                        error.message ||
                        ''
                    ).toLowerCase();


                if (
                    msg.includes(
                        'user already registered'
                    )
                ) {

                    toast(
                        'Este e-mail já está cadastrado.'
                    );

                } else if (

                    msg.includes(
                        'database error'
                    ) ||

                    msg.includes(
                        'phone'
                    ) ||

                    msg.includes(
                        'duplicate'
                    ) ||

                    msg.includes(
                        'unique'
                    )

                ) {

                    toast(
                        'Este WhatsApp já está cadastrado ou os dados já existem.'
                    );

                } else {

                    toast(
                        error.message ||
                        'Não foi possível criar a conta.'
                    );

                }


                return;
            }


            if (!data.user) {

                toast(
                    'Não foi possível criar o usuário.'
                );

                return;
            }


            if (data.session) {

                const {
                    error: profileError
                } =
                    await sb
                        .from('profiles')
                        .upsert({

                            id:
                                data.user.id,

                            name,

                            phone,

                            email,

                            birth,

                            role:
                                'client',

                            active:
                                true

                        });


                if (profileError) {

                    console.error(
                        profileError
                    );


                    toast(
                        'Conta criada, mas houve erro ao criar o perfil.'
                    );

                    return;
                }


                toast(
                    'Cliente cadastrado com sucesso!'
                );

            } else {

                toast(
                    'Conta criada. Confirme o e-mail para continuar.'
                );

            }

        };
}


/* =========================================================
   LOGOUT
   ========================================================= */

if ($('#logoutBtn')) {

    $('#logoutBtn').onclick =
        () =>
            sb.auth.signOut();

}


/* =========================================================
   AGENDA
   ========================================================= */

if ($('#refreshAgenda')) {

    $('#refreshAgenda').onclick =
        agenda;

}


if ($('#agendaDate')) {

    $('#agendaDate').onchange =
        agenda;

}


if ($('#agendaProfessional')) {

    $('#agendaProfessional').onchange =
        agenda;

}


/* =========================================================
   FORMULÁRIO SERVIÇOS
   ========================================================= */

if ($('#serviceForm')) {

    $('#serviceForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const name =
                $('#serviceName')
                    .value
                    .trim();


            const price =
                Number(
                    $('#servicePrice')
                        .value
                );


            const duration =
                Number(
                    $('#serviceDuration')
                        .value
                );


            if (
                !name ||
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {

                toast(
                    'Preencha os dados do serviço corretamente.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('services')
                    .insert({

                        name,

                        price,

                        duration,

                        active:
                            true

                    });


            if (error) {

                console.error(
                    error
                );


                toast(
                    error.message
                );

            } else {

                e.target.reset();


                await loadServices();


                toast(
                    'Serviço cadastrado.'
                );

            }

        };
}


/* =========================================================
   FORMULÁRIO ESTOQUE
   ========================================================= */

if ($('#stockForm')) {

    $('#stockForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const initialQty = Number($('#stockQty').value);
            const minQty = Number($('#stockMin').value);
            if (!Number.isFinite(initialQty) || initialQty < 0 || !Number.isFinite(minQty) || minQty < 0) {
                toast('Informe quantidades válidas.');
                return;
            }

            const { data: created, error } = await sb
                .from('inventory')
                .insert({
                    name: $('#stockName').value.trim(),
                    quantity: initialQty,
                    min_quantity: minQty
                })
                .select('id')
                .single();

            if (!error && initialQty > 0 && created?.id) {
                const { error: movementError } = await sb.from('inventory_movements').insert({
                    inventory_id: created.id,
                    type: 'in',
                    quantity: initialQty
                });
                if (movementError) console.error('Erro ao registrar entrada inicial:', movementError);
            }


            if (error) {

                toast(
                    error.message
                );

            } else {

                e.target.reset();


                await loadStock();


                toast(
                    'Produto cadastrado.'
                );

            }

        };
}


/* =========================================================
   FORMULÁRIO FINANCEIRO
   ========================================================= */

if ($('#financeForm')) {

    $('#financeForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('cash_entries')
                    .insert({

                        type:
                            $('#financeType')
                                .value,

                        description:
                            $('#financeDesc')
                                .value
                                .trim(),

                        amount:
                            Number(
                                $('#financeAmount')
                                    .value
                            ),

                        entry_date:
                            $('#financeDate')
                                .value

                    });


            if (error) {

                toast(
                    error.message
                );

            } else {

                e.target.reset();


                if ($('#financeDate')) {

                    $('#financeDate').value =
                        today();

                }


                await loadFinance();


                toast(
                    'Lançamento registrado.'
                );

            }

        };
}


/* =========================================================
   FORMULÁRIO EQUIPE
   ========================================================= */

if ($('#teamForm')) {

    $('#teamForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('professionals')
                    .insert({

                        name:
                            $('#teamName')
                                .value
                                .trim(),

                        phone:
                            $('#teamPhone')
                                .value
                                .trim(),

                        active:
                            true

                    });


            if (error) {

                toast(
                    error.message
                );

            } else {

                e.target.reset();


                await loadTeam();


                toast(
                    'Profissional cadastrado.'
                );

            }

        };
}


/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

$$('[data-week-enabled]').forEach(box => {
    box.addEventListener('change', () => {
        const row = box.closest('[data-weekday]');
        const enabled = box.checked;
        row?.querySelector('[data-week-start]')?.toggleAttribute('disabled', !enabled);
        row?.querySelector('[data-week-end]')?.toggleAttribute('disabled', !enabled);
        row?.querySelector('[data-week-lunch-start]')?.toggleAttribute('disabled', !enabled);
        row?.querySelector('[data-week-lunch-end]')?.toggleAttribute('disabled', !enabled);
        const nameEl = row?.querySelector('[data-week-name]');
        if (nameEl) {
            const baseName = nameEl.dataset.baseName || nameEl.textContent.replace(/\s+—.*$/, '').trim();
            nameEl.dataset.baseName = baseName;
            nameEl.textContent = enabled ? baseName : `${baseName} — NÃO ATENDE`;
        }
    });
});

if ($('#saveSettings')) {

    $('#saveSettings').onclick =
        async () => {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const patch = {

                name:
                    $('#setName')
                        .value
                        .trim()
                    ||
                    'DNH BARBEARIA',


                whatsapp:
                    digits(
                        $('#setWhatsapp')
                            .value
                    ),


                start_time:
                    $('#setStart')
                        .value,


                end_time:
                    $('#setEnd')
                        .value,


                slot_interval:
                    Number(
                        $('#setInterval')
                            .value
                    ),


                logo_url:
                    $('#setLogoUrl')
                        .value
                        .trim()
                    ||
                    'dnh-logo.png',

                weekly_schedule: Object.fromEntries($$('[data-weekday]').map(row => {
                    const enabled = row.querySelector('[data-week-enabled]')?.checked !== false;
                    return [row.dataset.weekday, {
                        enabled,
                        start: row.querySelector('[data-week-start]')?.value || '08:00',
                        end: row.querySelector('[data-week-end]')?.value || '18:00',
                        lunch_start: row.querySelector('[data-week-lunch-start]')?.value || '',
                        lunch_end: row.querySelector('[data-week-lunch-end]')?.value || ''
                    }];
                }))

            };


            const {
                error
            } =
                await sb
                    .from('settings')
                    .update(patch)
                    .eq('id', 1);


            if (error) {

                toast(
                    error.message
                );

            } else {

                settings = {

                    ...settings,

                    ...patch

                };


                await loadSettings();


                toast('Configurações salvas com sucesso.');
                showActionMessage('Configurações salvas com sucesso.');

            }

        };
}


/* =========================================================
   COPIAR LINK
   ========================================================= */

if ($('#copyShare')) {

    $('#copyShare').onclick =
        async () => {

            try {

                await navigator.clipboard.writeText(
                    location.href.split('?')[0]
                );


                toast(
                    'Link copiado.'
                );

            } catch (error) {

                console.error(
                    error
                );


                toast(
                    'Não foi possível copiar o link.'
                );

            }

        };
}


/* =========================================================
   COMPARTILHAR
   ========================================================= */

if ($('#shareBtn')) {

    $('#shareBtn').onclick =
        async () => {

            try {

                if (navigator.share) {

                    await navigator.share({

                        title:
                            settings.name,

                        url:
                            location.href.split('?')[0]

                    });

                } else {

                    await navigator.clipboard.writeText(
                        location.href.split('?')[0]
                    );


                    toast(
                        'Link copiado.'
                    );

                }

            } catch (error) {

                console.error(
                    error
                );

            }

        };
}


/* =========================================================
   PESQUISA DE CLIENTES
   ========================================================= */

if ($('#clientSearch')) {

    $('#clientSearch').oninput =
        e => {

            if (!isAdmin()) {
                return;
            }


            const q =
                e.target.value
                    .toLowerCase();


            renderClients(

                (
                    window.allClients ||
                    []
                ).filter(c => {

                    const text =
                        (
                            c.name ||
                            ''
                        )
                        +
                        ' '
                        +
                        (
                            c.phone ||
                            ''
                        )
                        +
                        ' '
                        +
                        (
                            c.email ||
                            ''
                        );


                    return text
                        .toLowerCase()
                        .includes(q);

                })

            );

        };
}


/* =========================================================
   FILTRO ANIVERSARIANTES
   ========================================================= */

if ($('#birthdayOnly')) {

    $('#birthdayOnly').onclick =
        () => {

            if (!isAdmin()) {
                return;
            }


            const month =
                today().slice(
                    5,
                    7
                );


            renderClients(

                (
                    window.allClients ||
                    []
                ).filter(

                    c =>
                        c.birth &&
                        c.birth.slice(
                            5,
                            7
                        ) === month

                )

            );

        };
}



/* =========================================================
   ADMINISTRADOR - NOVO AGENDAMENTO PARA CLIENTE
   ========================================================= */

async function novoAgendamentoAdmin() {

    if (!isAdmin()) {
        toast('Acesso restrito ao administrador.');
        return;
    }

    await loadSettings();
    await loadServices();
    await loadProfessionals();

    const {
        data: clients = [],
        error: clientsError
    } = await sb
        .from('profiles')
        .select('id,name,phone,email,birth')
        .eq('role', 'client')
        .order('name', { ascending: true });

    if (clientsError) {
        console.error('Erro ao carregar clientes para novo agendamento:', clientsError);
        toast('Não foi possível carregar os clientes.');
        return;
    }

    const activeServices = (services || []).filter(s => s.active !== false);
    const activeProfessionals = (professionals || []).filter(p => p.active !== false);

    if (!clients.length) {
        toast('Não há clientes cadastrados.');
        return;
    }

    if (!activeServices.length) {
        toast('Cadastre pelo menos um serviço ativo.');
        return;
    }

    if (!activeProfessionals.length) {
        toast('Cadastre pelo menos um profissional.');
        return;
    }

    const oldModal = document.querySelector('#adminBookingModal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'adminBookingModal';
    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:9999;
        background:rgba(0,0,0,.72);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--card,#151515);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:22px;box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.45);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;">
                <div>
                    <span class="eyebrow">ADMINISTRADOR</span>
                    <h2 style="margin:4px 0 0;">Novo agendamento</h2>
                    <p class="muted" style="margin:4px 0 0;">Agende um serviço para um cliente cadastrado.</p>
                </div>
                <button type="button" id="closeAdminBooking" class="ghost">✕</button>
            </div>

            <div style="display:grid;gap:14px;">
                <label>Cliente
                    <select id="adminBookingClient" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione o cliente</option>
                        ${clients.map(c => `<option value="${c.id}">${(c.name || c.email || 'Cliente').replace(/&/g,'&amp;').replace(/</g,'&lt;')} ${c.phone ? '• ' + c.phone : ''}</option>`).join('')}
                    </select>
                </label>

                <label>Serviço
                    <select id="adminBookingService" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione o serviço</option>
                        ${activeServices.map(s => `<option value="${s.id}">${(s.name || 'Serviço').replace(/&/g,'&amp;').replace(/</g,'&lt;')} — ${money(s.price)} — ${Number(s.duration) || 30} min</option>`).join('')}
                    </select>
                </label>

                <label>Profissional
                    <select id="adminBookingProfessional" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione o profissional</option>
                        ${activeProfessionals.map(p => `<option value="${p.id}">${(p.name || 'Profissional').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('')}
                    </select>
                </label>

                <label>Data
                    <input id="adminBookingDate" type="date" value="${today()}" min="${today()}" style="width:100%;box-sizing:border-box;">
                </label>

                <label>Horário
                    <select id="adminBookingTime" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione serviço, profissional e data</option>
                    </select>
                </label>

                <label>Observação (opcional)
                    <textarea id="adminBookingNotes" rows="3" placeholder="Observação do atendimento" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
                </label>

                <div id="adminBookingInfo" class="muted" style="font-size:13px;"></div>

                <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:4px;">
                    <button type="button" id="cancelAdminBooking" class="secondary">Cancelar</button>
                    <button type="button" id="saveAdminBooking" class="btn gold">Confirmar agendamento</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    $('#closeAdminBooking')?.addEventListener('click', close);
    $('#cancelAdminBooking')?.addEventListener('click', close);
    modal.addEventListener('click', e => {
        if (e.target === modal) close();
    });

    const clientSelect = $('#adminBookingClient');
    const serviceSelect = $('#adminBookingService');
    const professionalSelect = $('#adminBookingProfessional');
    const dateInput = $('#adminBookingDate');
    const timeSelect = $('#adminBookingTime');
    const info = $('#adminBookingInfo');

    async function carregarHorariosAdmin() {
        if (!timeSelect) return;

        const serviceId = serviceSelect?.value;
        const professionalId = professionalSelect?.value;
        const date = dateInput?.value;

        timeSelect.innerHTML = '<option value="">Carregando horários...</option>';
        if (info) info.textContent = '';

        if (!serviceId || !professionalId || !date) {
            timeSelect.innerHTML = '<option value="">Selecione serviço, profissional e data</option>';
            return;
        }

        const service = activeServices.find(s => s.id === serviceId);
        const duration = Number(service?.duration) || 30;

        const { data: bookings = [], error } = await sb
            .from('bookings')
            .select('id,booking_time,status,service_id')
            .eq('professional_id', professionalId)
            .eq('booking_date', date)
            .neq('status', 'cancelled');

        if (error) {
            console.error('Erro ao verificar horários do administrador:', error);
            timeSelect.innerHTML = '<option value="">Erro ao carregar horários</option>';
            if (info) info.textContent = error.message || '';
            return;
        }

        const serviceIds = [...new Set(bookings.map(b => b.service_id).filter(Boolean))];
        const durationMap = new Map(activeServices.map(s => [s.id, Number(s.duration) || 30]));

        if (serviceIds.length) {
            const missingIds = serviceIds.filter(id => !durationMap.has(id));
            if (missingIds.length) {
                const { data: otherServices = [] } = await sb
                    .from('services')
                    .select('id,duration')
                    .in('id', missingIds);
                otherServices.forEach(s => durationMap.set(s.id, Number(s.duration) || 30));
            }
        }

        const busy = bookings.map(b => {
            const start = timeToMinutes(String(b.booking_time || '').slice(0, 5));
            const end = start + (durationMap.get(b.service_id) || 30);
            return { start, end };
        }).filter(x => Number.isFinite(x.start));

        const daySchedule = scheduleForDate(date);
        if (daySchedule.enabled === false) {
            timeSelect.innerHTML = '<option value="">Não atende nesta data</option>';
            if (info) info.textContent = 'A barbearia não atende neste dia.';
            return;
        }

        const startMinutes = timeToMinutes(String(daySchedule.start || settings.start_time).slice(0, 5));
        const endMinutes = timeToMinutes(String(daySchedule.end || settings.end_time).slice(0, 5));
        const interval = Number(settings.slot_interval) || 30;
        const options = [];

        for (let current = startMinutes; current + duration <= endMinutes; current += interval) {
            const hour = String(Math.floor(current / 60)).padStart(2, '0');
            const minute = String(current % 60).padStart(2, '0');
            const time = `${hour}:${minute}`;
            const lunchStart = timeToMinutes(String(daySchedule.lunch_start || '').slice(0, 5));
            const lunchEnd = timeToMinutes(String(daySchedule.lunch_end || '').slice(0, 5));
            const inLunch = Number.isFinite(lunchStart) && Number.isFinite(lunchEnd) && lunchEnd > lunchStart && current < lunchEnd && current + duration > lunchStart;
            const conflict = busy.some(b => current < b.end && current + duration > b.start);
            if (!inLunch && !conflict) options.push(`<option value="${time}">${time}</option>`);
        }

        timeSelect.innerHTML = options.length
            ? '<option value="">Selecione o horário</option>' + options.join('')
            : '<option value="">Nenhum horário disponível</option>';

        if (info) {
            info.textContent = options.length
                ? `${options.length} horário(s) disponível(is) para este serviço.`
                : 'Não há horários disponíveis para esta data, profissional e serviço.';
        }
    }

    serviceSelect?.addEventListener('change', carregarHorariosAdmin);
    professionalSelect?.addEventListener('change', carregarHorariosAdmin);
    dateInput?.addEventListener('change', carregarHorariosAdmin);

    $('#saveAdminBooking')?.addEventListener('click', async () => {
        const clientId = clientSelect?.value;
        const serviceId = serviceSelect?.value;
        const professionalId = professionalSelect?.value;
        const date = dateInput?.value;
        const time = timeSelect?.value;
        const notes = $('#adminBookingNotes')?.value.trim() || null;
        const button = $('#saveAdminBooking');

        if (!clientId || !serviceId || !professionalId || !date || !time) {
            alert('Selecione cliente, serviço, profissional, data e horário antes de confirmar o agendamento.');
            return;
        }

        const daySchedule = scheduleForDate(date);
        if (daySchedule.enabled === false) {
            alert('A barbearia não atende nesta data. Escolha outro dia.');
            await carregarHorariosAdmin();
            return;
        }

        const selectedMinutes = timeToMinutes(time);
        const lunchStart = timeToMinutes(String(daySchedule.lunch_start || '').slice(0, 5));
        const lunchEnd = timeToMinutes(String(daySchedule.lunch_end || '').slice(0, 5));
        if (Number.isFinite(lunchStart) && Number.isFinite(lunchEnd) && lunchEnd > lunchStart && Number.isFinite(selectedMinutes) && selectedMinutes < lunchEnd) {
            const selectedService = activeServices.find(s => s.id === serviceId);
            const selectedDuration = Number(selectedService?.duration) || 30;
            if (selectedMinutes + selectedDuration > lunchStart) {
                alert('O horário escolhido está dentro do intervalo reservado para almoço. Escolha outro horário.');
                await carregarHorariosAdmin();
                return;
            }
        }

        if (button) {
            button.disabled = true;
            button.textContent = 'Agendando...';
        }

        const { data: existing, error: checkError } = await sb
            .from('bookings')
            .select('id')
            .eq('professional_id', professionalId)
            .eq('booking_date', date)
            .eq('booking_time', time + ':00')
            .neq('status', 'cancelled')
            .limit(1)
            .maybeSingle();

        if (checkError) {
            console.error('Erro ao verificar horário:', checkError);
            toast('Não foi possível verificar o horário.');
            if (button) { button.disabled = false; button.textContent = 'Confirmar agendamento'; }
            return;
        }

        if (existing) {
            toast('Esse horário já foi ocupado. Escolha outro.');
            await carregarHorariosAdmin();
            if (button) { button.disabled = false; button.textContent = 'Confirmar agendamento'; }
            return;
        }

        const { error } = await sb.from('bookings').insert({
            user_id: clientId,
            service_id: serviceId,
            professional_id: professionalId,
            booking_date: date,
            booking_time: time + ':00',
            status: 'confirmed',
            notes
        });

        if (error) {
            console.error('Erro ao criar agendamento pelo administrador:', error);
            toast(error.message || 'Não foi possível realizar o agendamento.');
            if (button) { button.disabled = false; button.textContent = 'Confirmar agendamento'; }
            return;
        }

        toast('Agendamento criado com sucesso!');
        close();
        await agenda();
    });

    await carregarHorariosAdmin();
}

/* =========================================================
   EVENTOS GERAIS
   ========================================================= */

document.addEventListener(
    'click',
    async e => {

        const financeEdit = e.target.closest('[data-finance-edit]');
        if (financeEdit) {
            await editarLancamentoFinanceiro(financeEdit.dataset.financeEdit);
            return;
        }

        const financeDelete = e.target.closest('[data-finance-delete]');
        if (financeDelete) {
            await excluirLancamentoFinanceiro(financeDelete.dataset.financeDelete);
            return;
        }

        const stockEntry = e.target.closest('[data-stock-entry]');
        if (stockEntry) { await registrarMovimentoEstoque(stockEntry.dataset.stockEntry,'in'); return; }
        const stockExit = e.target.closest('[data-stock-exit]');
        if (stockExit) { await registrarMovimentoEstoque(stockExit.dataset.stockExit,'out'); return; }
        const stockDelete = e.target.closest('[data-stock-delete]');
        if (stockDelete) {
            if (confirm('Excluir este produto do estoque?')) {
                const {error}=await sb.from('inventory').delete().eq('id',stockDelete.dataset.stockDelete);
                if(error){console.error('Erro ao excluir produto:',error);toast(error.message||'Não foi possível excluir o produto.');} else {toast('Produto excluído.');await loadStock();}
            }
            return;
        }

        const clientDelete = e.target.closest('[data-client-delete]');
        if (clientDelete) {
            await excluirCliente(clientDelete.dataset.clientDelete);
            return;
        }

        const serviceDelete = e.target.closest('[data-service-delete]');
        if (serviceDelete) {
            await excluirServico(serviceDelete.dataset.serviceDelete);
            return;
        }

        const teamEdit = e.target.closest('[data-team-edit]');
        if (teamEdit) {
            await editarProfissional(teamEdit.dataset.teamEdit);
            return;
        }

        const teamVacation = e.target.closest('[data-team-vacation]');
        if (teamVacation) {
            await alterarStatusEquipe(teamVacation.dataset.teamVacation, 'vacation');
            return;
        }

        const teamActive = e.target.closest('[data-team-active]');
        if (teamActive) {
            await alterarStatusEquipe(teamActive.dataset.teamActive, 'active');
            return;
        }

        const teamInactive = e.target.closest('[data-team-inactive]');
        if (teamInactive) {
            await alterarStatusEquipe(teamInactive.dataset.teamInactive, 'inactive');
            return;
        }

        const teamDelete = e.target.closest('[data-team-delete]');
        if (teamDelete) {
            await excluirProfissional(teamDelete.dataset.teamDelete);
            return;
        }

        /* -------------------------
           EDITAR SERVIÇO
           ------------------------- */

        const editService =
            e.target.closest(
                '[data-service-edit]'
            );


        if (editService) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            await editarServico(
                editService.dataset
                    .serviceEdit
            );


            return;
        }


        /* -------------------------
           ATIVAR / DESATIVAR SERVIÇO
           ------------------------- */

        const serviceToggle =
            e.target.closest(
                '[data-service-toggle]'
            );


        if (serviceToggle) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const service =
                services.find(
                    s =>
                        s.id ===
                        serviceToggle
                            .dataset
                            .serviceToggle
                );


            if (!service) {
                return;
            }


            const {
                error
            } =
                await sb
                    .from('services')
                    .update({

                        active:
                            !service.active

                    })
                    .eq(
                        'id',
                        service.id
                    );


            if (error) {

                console.error(
                    'Erro ao alterar serviço:',
                    error
                );


                toast(
                    'Não foi possível alterar o serviço.'
                );

                return;
            }


            toast(
                service.active
                    ? 'Serviço desativado.'
                    : 'Serviço ativado.'
            );


            await loadServices();

            return;
        }


        /* -------------------------
           HORÁRIO DO CLIENTE
           ------------------------- */

        const timeButton =
            e.target.closest(
                '[data-booking-time]'
            );


        if (timeButton) {

            if (!isClient()) {
                return;
            }


            $$('.time-option')
                .forEach(
                    button =>
                        button.classList.remove(
                            'selected'
                        )
                );


            timeButton.classList.add('selected');
            $$('.time-option').forEach(button => {
                button.style.background = '';
                button.style.color = '';
                button.style.borderColor = '';
            });
            timeButton.style.background = '#22a861';
            timeButton.style.color = '#fff';
            timeButton.style.borderColor = '#22a861';


            atualizarResumoAgendamento(
                timeButton.dataset
                    .bookingTime
            );


            return;
        }


        /* -------------------------
           STATUS DO AGENDAMENTO
           ------------------------- */

        const statusButton =
            e.target.closest(
                '[data-status-booking]'
            );


        if (statusButton) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const bookingId =
                statusButton.dataset
                    .statusBooking;


            const newStatus =
                statusButton.dataset
                    .status;


            if (
                !bookingId ||
                !newStatus
            ) {
                return;
            }


            let statusText =
                'Confirmado';


            if (
                newStatus ===
                'in_progress'
            ) {

                statusText =
                    'Em atendimento';

            }


            if (
                newStatus ===
                'completed'
            ) {

                statusText =
                    'Concluído';

            }


            let error = null;
            if (newStatus === 'completed') {
                const { error: rpcError } = await sb.rpc('complete_booking_and_register_finance', { p_booking_id: bookingId });
                error = rpcError;
            } else {
                const result = await sb.from('bookings').update({ status:newStatus, updated_at:new Date().toISOString() }).eq('id',bookingId);
                error = result.error;
            }


            if (error) {

                console.error(
                    'Erro ao alterar status:',
                    error
                );


                toast(
                    'Não foi possível alterar o status.'
                );

                return;
            }


            toast(
                'Agendamento: ' +
                statusText
            );


            await agenda();

            return;
        }


        /* -------------------------
           CANCELAMENTO ADMIN
           ------------------------- */

        const cancelButton =
            e.target.closest(
                '[data-cancel]'
            );


        if (cancelButton) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const confirmar =
                confirm(
                    'Deseja cancelar este agendamento?'
                );


            if (!confirmar) {
                return;
            }


            const {
                error
            } =
                await sb
                    .from('bookings')
                    .update({

                        status:
                            'cancelled'

                    })
                    .eq(
                        'id',
                        cancelButton.dataset
                            .cancel
                    );


            if (error) {

                console.error(
                    'Erro ao cancelar:',
                    error
                );


                toast(
                    'Não foi possível cancelar o agendamento.'
                );

                return;
            }


            await agenda();


            toast(
                'Agendamento cancelado.'
            );


            return;
        }


        /* -------------------------
           CANCELAMENTO CLIENTE
           ------------------------- */

        const clientCancel =
            e.target.closest(
                '[data-client-cancel]'
            );


        if (clientCancel) {

            if (!isClient()) {

                toast(
                    'Acesso não permitido.'
                );

                return;
            }


            await cancelarMeuAgendamento(
                clientCancel.dataset
                    .clientCancel
            );


            return;
        }


        /* -------------------------
           WHATSAPP
           ------------------------- */

        const whatsapp =
            e.target.closest(
                '[data-wa]'
            );


        if (whatsapp) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            window.open(
                'https://wa.me/' +
                whatsapp.dataset.wa +
                '?text=' +
                whatsapp.dataset.msg,
                '_blank'
            );


            return;
        }

    }
);


/* =========================================================
   EVENTOS DO CLIENTE
   ========================================================= */

if ($('#clientService')) {

    $('#clientService').onchange =
        async () => {

            if (!isClient()) {
                return;
            }


            atualizarResumoAgendamento(
                ''
            );


            await loadClientTimes();

        };
}


if ($('#clientProfessional')) {

    $('#clientProfessional').onchange =
        async () => {

            if (!isClient()) {
                return;
            }


            atualizarResumoAgendamento(
                ''
            );


            await loadClientTimes();

        };
}


if ($('#clientDate')) {

    $('#clientDate').onchange =
        async () => {

            if (!isClient()) {
                return;
            }


            atualizarResumoAgendamento(
                ''
            );


            await loadClientTimes();

        };
}


if ($('#confirmBooking')) {

    $('#confirmBooking').onclick =
        async () => {

            const button = $('#confirmBooking');

            if (button?.disabled) {
                return;
            }

            if (button) {
                button.disabled = true;
                button.textContent = 'Agendando...';
            }

            try {
                await createBooking();
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Confirmar agendamento';
                }
            }
        };

}


if ($('#refreshClientBookings')) {

    $('#refreshClientBookings').onclick =
        consultarAgenda;

}


/* =========================================================
   MOBILE
   ========================================================= */

function configurarMobileNav() {

    const mobileButtons =
        $$('.mobile-nav [data-page]');


    if (!mobileButtons.length) {
        return;
    }


    /* =====================================================
       ADMINISTRADOR
       ===================================================== */

    if (isAdmin()) {

        mobileButtons.forEach(button => {

            button.style.display = '';

        });


        /* Restaurar botão inicial */

        const firstButton =
            mobileButtons[0];


        if (firstButton) {

            firstButton.dataset.page =
                'dashboard';


            firstButton.innerHTML = `
                ⌂
                <span>
                    Início
                </span>
            `;

        }


        return;
    }


    /* =====================================================
       CLIENTE
       ===================================================== */

    mobileButtons.forEach(button => {

        button.style.display =
            'none';

    });


    /* -------------------------
       BOTÃO 1 = CONSULTAR
       ------------------------- */

    const firstButton =
        mobileButtons[0];


    if (firstButton) {

        firstButton.style.display =
            '';


        firstButton.dataset.page =
            'consultar';


        firstButton.innerHTML = `
            🔎
            <span>
                Meus agendamentos
            </span>
        `;

    }


    /* -------------------------
       BOTÃO 2 = AGENDA
       ------------------------- */

    const agendaButton =
        mobileButtons.find(
            button =>
                button.dataset.page ===
                'agenda'
        );


    if (agendaButton) {

        agendaButton.style.display =
            '';


        agendaButton.innerHTML = `
            ▣
            <span>
                Agendar
            </span>
        `;

    }
}


/* =========================================================
   BOOT
   ========================================================= */

async function boot() {

    if (!configured()) {

        if ($('#configNotice')) {

            $('#configNotice')
                .classList
                .remove('hidden');

        }


        if ($('#loginForm')) {

            $('#loginForm').style.display =
                'none';

        }


        return;
    }


    const {
        data: {
            session
        }
    } =
        await sb.auth.getSession();


    if (
        session &&
        await user()
    ) {

        $('#appView')
            ?.classList
            .remove('hidden');


        $('#authView')
            ?.classList
            .add('hidden');


        if ($('#roleLabel')) {

            $('#roleLabel').textContent =
                profile.role === 'admin'
                    ? 'Administrador'
                    : 'Cliente';

        }


        aplicarPermissoesUI();


        configurarMobileNav();


        await loadSettings();


        if (
            profile.role ===
            'admin'
        ) {

            await loadProfessionals();

            go(
                'dashboard'
            );

        } else {

            await loadServices();

            await loadProfessionals();

            initClientBooking();

            go(
                'agenda'
            );

        }

    }


    /* =====================================================
       ALTERAÇÃO DE AUTENTICAÇÃO
       ===================================================== */

    sb.auth.onAuthStateChange(
        async (_event, session) => {

            if (session) {

                if (await user()) {

                    $('#appView')
                        ?.classList
                        .remove('hidden');


                    $('#authView')
                        ?.classList
                        .add('hidden');


                    if ($('#roleLabel')) {

                        $('#roleLabel')
                            .textContent =
                            profile.role === 'admin'
                                ? 'Administrador'
                                : 'Cliente';

                    }


                    aplicarPermissoesUI();


                    configurarMobileNav();


                    await loadSettings();


                    if (
                        profile.role ===
                        'admin'
                    ) {

                        await loadProfessionals();

                        go(
                            'dashboard'
                        );

                    } else {

                        await loadServices();

                        await loadProfessionals();

                        initClientBooking();

                        go(
                            'agenda'
                        );

                    }

                }

            } else {

                profile = null;


                $('#appView')
                    ?.classList
                    .add('hidden');


                $('#authView')
                    ?.classList
                    .remove('hidden');

            }

        }
    );


    if ($('#agendaDate')) {

        $('#agendaDate').value =
            today();

    }


    if ($('#financeDate')) {

        $('#financeDate').value =
            today();

    }

    if ($('#financeMonth')) {
        $('#financeMonth').value = today().slice(0, 7);
    }
    updateFinanceMonthControl();

}


boot();