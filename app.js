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
    logo_url: 'dnh-logo.png'
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
        const page =
            button.dataset.page;
        if (
            ADMIN_PAGES.includes(page)
        ) {
            button.style.display =
                admin ? '' : 'none';
        }
    });
}
/* =========================================================
   AUTENTICAÇÃO / PERFIL
   ========================================================= */
async function user() {
    const {
        data: {
            user: authUser
        }
    } = await sb.auth.getUser();
    if (!authUser) {
        profile = null;
        return null;
    }
    const {
        data,
        error
    } = await sb
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
    if (error) {
        console.error(
            'Erro ao carregar perfil:',
            error
        );
        profile = null;
        return null;
    }
    profile = data;
    console.log(
        'PERFIL LOGADO:',
        profile
    );
    console.log(
        'ROLE:',
        profile?.role
    );
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
                                    class="${service.active
                            ? 'ok'
                            : 'cancel'
                        }"
                                >
                                    ${service.active
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
                                    ${service.active
                            ? 'Desativar'
                            : 'Ativar'
                        }
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
            const cleanPrice =
                String(priceText)
                    .replace(/\s/g, '')
                    .replace(/\./g, '')
                    .replace(',', '.');
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
        data: clients = []
    } = await sb
        .from('profiles')
        .select(
            'name,birth,phone'
        )
        .eq(
            'role',
            'client'
        );
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
    const birthdays =
        clients
            .filter(
                x =>
                    x.birth &&
                    x.birth.slice(5, 7) ===
                    month.slice(5, 7)
            )
            .sort(
                (a, b) =>
                    a.birth.slice(8)
                        .localeCompare(
                            b.birth.slice(8)
                        )
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
                                ${b.booking_time
                        ?.slice(0, 5) ||
                    ''
                    }
                            </b>
                            <small>
                                Agendamento
                            </small>
                        </div>
                        <span
                            class="${b.status ===
                        'cancelled'
                        ? 'cancel'
                        : 'ok'
                    }"
                        >
                            ${b.status ===
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
                .map(c => `
                    <div class="list-row">
                        <div>
                            <b>
                                🎂
                                ${c.name || 'Cliente'}
                            </b>
                            <small>
                                ${c.birth.slice(8, 10)}/${c.birth.slice(5, 7)}
                                •
                                ${c.phone || ''}
                            </small>
                        </div>
                        <span>
                            ${c.birth.slice(8, 10) ===
                        today().slice(8, 10)
                        ? 'Hoje'
                        : ''
                    }
                        </span>
                    </div>
                `)
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
   AGENDA ADMINISTRATIVA — VISUAL DE BARBEARIA
   ========================================================= */
async function agendaAdmin() {
    await loadSettings();
    await loadProfessionals();
    const page = $('#page-agenda');
    if (!page) return;
    page.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Agenda da Barbearia</h1>
                <p class="muted">
                    Visualização dos horários e atendimentos.
                </p>
            </div>
        </div>
        <div style="
            display:grid;
            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(190px,1fr)
                );
            gap:12px;
            margin:20px 0;
        ">
            <!-- DATA -->
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
            <!-- BARBEIRO -->
            <div>
                <label
                    for="adminAgendaProfessional"
                    style="
                        display:block;
                        margin-bottom:6px;
                        font-weight:600;
                    "
                >
                    Barbeiro
                </label>
                <select
                    id="adminAgendaProfessional"
                    style="
                        width:100%;
                        box-sizing:border-box;
                    "
                >
                    <option value="">
                        Todos os barbeiros
                    </option>
                </select>
            </div>
            <!-- BOTÕES -->
            <div
                style="
                    display:flex;
                    align-items:flex-end;
                    gap:8px;
                "
            >
                <button
                    type="button"
                    id="adminAgendaToday"
                    style="width:100%;"
                >
                    Hoje
                </button>
                <button
                    type="button"
                    id="adminNovoAgendamento"
                    data-admin-new-booking
                    style="width:100%;"
                >
                    ➕ Novo Agendamento
                </button>
                <button
                    type="button"
                    id="adminAgendaClear"
                    style="width:100%;"
                >
                    Todos
                </button>
            </div>
        </div>
        <!-- RESUMO -->
        <div
            id="adminAgendaSummary"
            style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin-bottom:16px;
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
    const dateInput =
        $('#adminAgendaDate');
        if (dateInput) {
    dateInput.value = today();
}
    const professionalInput =
        $('#adminAgendaProfessional');
    const todayButton =
        $('#adminAgendaToday');
    const clearButton =
        $('#adminAgendaClear');
    /*
     * PROFISSIONAIS
     */
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
            professionalInput?.appendChild(
                option
            );
        }
    );
    /*
     * FORMATAR DATA
     */
    const formatDate =
        date => {
            if (!date) return '-';
            const [
                year,
                month,
                day
            ] =
                date.split('-');
            return `
                ${day}/${month}/${year}
            `;
        };
    /*
     * DIA DA SEMANA
     */
    const dayName =
        date => {
            const [
                year,
                month,
                day
            ] =
                date
                    .split('-')
                    .map(Number);
            return new Date(
                year,
                month - 1,
                day
            ).toLocaleDateString(
                'pt-BR',
                {
                    weekday:'long'
                }
            );
        };
    /*
     * CONVERTER HORÁRIO PARA MINUTOS
     */
    const toMinutes =
        time => {
            if (!time) return 0;
            const [
                h,
                m
            ] =
                String(time)
                    .slice(0,5)
                    .split(':')
                    .map(Number);
            return (
                h * 60 +
                m
            );
        };
    /*
     * CONVERTER MINUTOS PARA HORÁRIO
     */
    const toTime =
        minutes => {
            const h =
                Math.floor(
                    minutes / 60
                );
            const m =
                minutes % 60;
            return (
                String(h)
                    .padStart(2,'0') +
                ':' +
                String(m)
                    .padStart(2,'0')
            );
        };
    /*
     * STATUS
     */
    const statusInfo =
        status => {
            if (
                status ===
                'completed'
            ) {
                return {
                    text:'Concluído',
                    className:'ok'
                };
            }
            if (
                status ===
                'cancelled'
            ) {
                return {
                    text:'Cancelado',
                    className:'cancel'
                };
            }
            if (
                status ===
                'in_progress'
            ) {
                return {
                    text:'Em atendimento',
                    className:'progress'
                };
            }
            return {
                text:'Confirmado',
                className:'ok'
            };
        };
    /*
     * CARREGAR AGENDA
     */
    async function carregarAgendaAdmin() {
        const calendar =
            $('#adminAgendaCalendar');
        const summary =
            $('#adminAgendaSummary');
        if (!calendar) return;
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
                        ascending:true
                    }
                )
                .order(
                    'booking_time',
                    {
                        ascending:true
                    }
                );
        /*
         * FILTRO DATA
         */
        if (
            dateInput?.value
        ) {
            query =
                query.eq(
                    'booking_date',
                    dateInput.value
                );
        }
        /*
         * FILTRO BARBEIRO
         */
        if (
            professionalInput?.value
        ) {
            query =
                query.eq(
                    'professional_id',
                    professionalInput.value
                );
        }
        const {
            data: bookings = [],
            error
        } =
            await query;
        if (error) {
            console.error(
                'Erro ao carregar agenda:',
                error
            );
            calendar.innerHTML = `
                <div
                    style="
                        padding:20px;
                        border:1px solid
                            rgba(128,128,128,.25);
                        border-radius:14px;
                    "
                >
                    <strong>
                        Erro ao carregar a agenda.
                    </strong>
                    <small
                        class="muted"
                        style="
                            display:block;
                            margin-top:6px;
                        "
                    >
                        ${error.message || ''}
                    </small>
                </div>
            `;
            return;
        }
        /*
         * RESUMO
         */
        const confirmed =
            bookings.filter(
                b =>
                    b.status !==
                    'cancelled' &&
                    b.status !==
                    'completed'
            ).length;
        const completed =
            bookings.filter(
                b =>
                    b.status ===
                    'completed'
            ).length;
        const cancelled =
            bookings.filter(
                b =>
                    b.status ===
                    'cancelled'
            ).length;
        summary.innerHTML = `
            <span style="
                padding:7px 10px;
                border-radius:999px;
                background:
                    rgba(128,128,128,.10);
            ">
                📅
                ${bookings.length}
                agendamento(s)
            </span>
            <span style="
                padding:7px 10px;
                border-radius:999px;
                background:
                    rgba(128,128,128,.10);
            ">
                🟢
                ${confirmed}
                confirmado(s)
            </span>
            <span style="
                padding:7px 10px;
                border-radius:999px;
                background:
                    rgba(128,128,128,.10);
            ">
                ✓
                ${completed}
                concluído(s)
            </span>
            ${
                cancelled
                    ? `
                        <span style="
                            padding:7px 10px;
                            border-radius:999px;
                            background:
                                rgba(128,128,128,.10);
                        ">
                            ✕
                            ${cancelled}
                            cancelado(s)
                        </span>
                    `
                    : ''
            }
        `;
        /*
         * NENHUM AGENDAMENTO
         */
        if (!bookings.length) {
            calendar.innerHTML = `
                <div
                    style="
                        padding:40px 20px;
                        text-align:center;
                        border:
                            1px dashed
                            rgba(128,128,128,.35);
                        border-radius:16px;
                    "
                >
                    <div
                        style="
                            font-size:38px;
                        "
                    >
                        ✂️
                    </div>
                    <strong>
                        Nenhum agendamento
                    </strong>
                    <p class="muted">
                        Não existem horários
                        para o filtro selecionado.
                    </p>
                </div>
            `;
            return;
        }
        /*
         * BUSCAR SERVIÇOS
         */
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
        /*
         * BUSCAR CLIENTES
         */
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
        /*
         * BUSCAR BARBEIROS
         */
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
        let serviceMap =
            new Map();
        let profileMap =
            new Map();
        let professionalMap =
            new Map();
        if (serviceIds.length) {
            const {
                data = []
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
                    data.map(
                        item => [
                            item.id,
                            item
                        ]
                    )
                );
        }
        if (userIds.length) {
            const {
                data = []
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
                    data.map(
                        item => [
                            item.id,
                            item
                        ]
                    )
                );
        }
        if (professionalIds.length) {
            const {
                data = []
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
                    data.map(
                        item => [
                            item.id,
                            item
                        ]
                    )
                );
        }
        /*
         * AGRUPAR POR DIA
         */
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
        /*
         * MONTAR OS DIAS
         */
        calendar.innerHTML =
            [...groups.entries()]
                .map(
                    ([date,dayBookings]) => {
                        dayBookings.sort(
                            (a,b) =>
                                toMinutes(
                                    a.booking_time
                                ) -
                                toMinutes(
                                    b.booking_time
                                )
                        );
                        /*
                         * BARBEIROS DO DIA
                         */
                        const dayProfessionals =
                            [
                                ...new Map(
                                    dayBookings.map(
                                        booking => {
                                            const professional =
                                                professionalMap.get(
                                                    booking.professional_id
                                                );
                                            const id =
                                                booking.professional_id ||
                                                'sem-profissional';
                                            return [
                                                id,
                                                {
                                                    id,
                                                    name:
                                                        professional?.name ||
                                                        'Sem barbeiro'
                                                }
                                            ];
                                        }
                                    )
                                ).values()
                            ];
                        if (
                            !dayProfessionals.length
                        ) {
                            dayProfessionals.push({
                                id:
                                    'sem-profissional',
                                name:
                                    'Sem barbeiro'
                            });
                        }
                        /*
                         * PRIMEIRO E ÚLTIMO HORÁRIO
                         */
                        const starts =
                            dayBookings.map(
                                b =>
                                    toMinutes(
                                        b.booking_time
                                    )
                            );
                        const ends =
                            dayBookings.map(
                                b => {
                                    const service =
                                        serviceMap.get(
                                            b.service_id
                                        );
                                    const duration =
                                        Number(
                                            service?.duration
                                        ) || 30;
                                    return (
                                        toMinutes(
                                            b.booking_time
                                        ) +
                                        duration
                                    );
                                }
                            );
                        const first =
                            Math.min(
                                ...(
                                    starts.length
                                        ? starts
                                        : [480]
                                )
                            );
                        const last =
                            Math.max(
                                ...(
                                    ends.length
                                        ? ends
                                        : [1200]
                                )
                            );
                        /*
                         * AGENDA NORMAL:
                         * começa no mínimo às 08:00
                         * e termina no mínimo às 20:00.
                         */
                        const startMinutes =
                            Math.min(
                                480,
                                Math.floor(
                                    first / 30
                                ) * 30
                            );
                        const endMinutes =
                            Math.max(
                                1200,
                                Math.ceil(
                                    last / 30
                                ) * 30
                            );
                        const slotCount =
                            Math.max(
                                1,
                                (
                                    endMinutes -
                                    startMinutes
                                ) / 30
                            );
                        const columns =
                            dayProfessionals.length;
                        /*
                         * FUNDO DA GRADE
                         */
                        const background = [];
                        for (
                            let row = 0;
                            row < slotCount;
                            row++
                        ) {
                            background.push(`
                                <div
                                    style="
                                        grid-column:1;
                                        grid-row:${row + 2};
                                        min-height:58px;
                                        padding:8px;
                                        border-top:
                                            1px solid
                                            rgba(128,128,128,.14);
                                        font-size:11px;
                                        font-weight:700;
                                    "
                                >
                                    ${toTime(
                                        startMinutes +
                                        row * 30
                                    )}
                                </div>
                            `);
                            for (
                                let col = 0;
                                col < columns;
                                col++
                            ) {
                                background.push(`
                                    <div
                                        style="
                                            grid-column:
                                                ${col + 2};
                                            grid-row:
                                                ${row + 2};
                                            min-height:58px;
                                            border-top:
                                                1px solid
                                                rgba(128,128,128,.12);
                                            border-left:
                                                1px solid
                                                rgba(128,128,128,.12);
                                            background:
                                                ${
                                                    row % 2 === 0
                                                        ? 'rgba(128,128,128,.025)'
                                                        : 'transparent'
                                                };
                                        "
                                    ></div>
                                `);
                            }
                        }
                        /*
                         * CABEÇALHO DOS BARBEIROS
                         */
                        const headers =
                            dayProfessionals
                                .map(
                                    professional => `
                                        <div
                                            style="
                                                padding:12px;
                                                text-align:center;
                                                font-weight:700;
                                                border-left:
                                                    1px solid
                                                    rgba(128,128,128,.16);
                                                min-width:180px;
                                            "
                                        >
                                            ${professional.name}
                                        </div>
                                    `
                                )
                                .join('');
                        /*
                         * CARTÕES DOS AGENDAMENTOS
                         */
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
                                        const professionalId =
                                            booking.professional_id ||
                                            'sem-profissional';
                                        let col =
                                            dayProfessionals.findIndex(
                                                p =>
                                                    p.id ===
                                                    professionalId
                                            );
                                        if (col < 0) {
                                            col = 0;
                                        }
                                        const start =
                                            toMinutes(
                                                booking.booking_time
                                            );
                                        const duration =
                                            Math.max(
                                                30,
                                                Number(
                                                    service?.duration
                                                ) || 30
                                            );
                                        const roundedStart =
                                            Math.floor(
                                                start / 30
                                            ) * 30;
                                        const row =
                                            2 +
                                            Math.max(
                                                0,
                                                Math.round(
                                                    (
                                                        roundedStart -
                                                        startMinutes
                                                    ) / 30
                                                )
                                            );
                                        const span =
                                            Math.max(
                                                1,
                                                Math.ceil(
                                                    duration / 30
                                                )
                                            );
                                        const time =
                                            booking.booking_time
                                                ?.slice(
                                                    0,
                                                    5
                                                ) ||
                                            '--:--';
                                        const clientName =
                                            client?.name ||
                                            'Cliente';
                                        const phone =
                                            client?.phone ||
                                            '';
                                        const serviceName =
                                            service?.name ||
                                            'Serviço';
                                        const price =
                                            money(
                                                service?.price
                                            );
                                        const cancelled =
                                            booking.status ===
                                            'cancelled';
                                        return `
                                            <div
                                                style="
                                                    grid-column:
                                                        ${col + 2};
                                                    grid-row:
                                                        ${row}
                                                        / span
                                                        ${span};
                                                    z-index:5;
                                                    margin:5px;
                                                    min-width:0;
                                                    padding:9px;
border-radius:10px;
overflow:visible;
opacity:
                                                        ${
                                                            cancelled
                                                                ? '.55'
                                                                : '1'
                                                        };
                                                    background:
                                                        var(--card,#1a1a1a);
                                                    border:
                                                        1px solid
                                                        rgba(
                                                            180,
                                                            150,
                                                            90,
                                                            .45
                                                        );
                                                    box-shadow:
                                                        0 4px 12px
                                                        rgba(
                                                            0,
                                                            0,
                                                            0,
                                                            .18
                                                        );
                                                "
                                            >
                                                <div
                                                    style="
                                                        display:flex;
                                                        justify-content:
                                                            space-between;
                                                        gap:6px;
                                                    "
                                                >
                                                    <strong>
                                                        ${time}
                                                    </strong>
                                                    <span
                                                        class="${status.className}"
                                                        style="
                                                            font-size:10px;
                                                        "
                                                    >
                                                        ${status.text}
                                                    </span>
                                                </div>
                                                <div
                                                    style="
                                                        margin-top:5px;
                                                        font-weight:700;
                                                        white-space:nowrap;
                                                        overflow:hidden;
                                                        text-overflow:ellipsis;
                                                    "
                                                >
                                                    ${clientName}
                                                </div>
                                                <div
                                                    style="
                                                        margin-top:3px;
                                                        font-size:12px;
                                                        white-space:nowrap;
                                                        overflow:hidden;
                                                        text-overflow:ellipsis;
                                                    "
                                                >
                                                    ✂️
                                                    ${serviceName}
                                                </div>
                                                <div
                                                    class="muted"
                                                    style="
                                                        margin-top:3px;
                                                        font-size:11px;
                                                    "
                                                >
                                                    ${duration}
                                                    min ·
                                                    ${price}
                                                </div>
                                                ${
                                                    !cancelled
                                                        ? `
                                                            <div
                                                                style="
                                                                    display:flex;
                                                                    gap:5px;
                                                                    flex-wrap:wrap;
                                                                    margin-top:8px;
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
                                                                                style="
                                                                                    font-size:11px;
                                                                                    padding:5px 7px;
                                                                                "
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
                                                                    style="
                                                                        font-size:11px;
                                                                        padding:5px 7px;
                                                                    "
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
                                                                                style="
                                                                                    font-size:11px;
                                                                                    padding:5px 7px;
                                                                                "
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
                                    }
                                )
                                .join('');
                        /*
                         * DIA COMPLETO
                         */
                        return `
                            <section
                                style="
                                    border:1px solid
                                    rgba(128,128,128,.22);
                                    border-radius:16px;
                                    overflow:hidden;
                                "
                            >
                                <div
                                    style="
                                        display:flex;
                                        justify-content:
                                            space-between;
                                        align-items:center;
                                        gap:12px;
                                        flex-wrap:wrap;
                                        padding:15px 18px;
                                        background:
                                            rgba(128,128,128,.08);
                                    "
                                >
                                    <div>
                                        <strong
                                            style="
                                                font-size:18px;
                                                text-transform:
                                                    capitalize;
                                            "
                                        >
                                            ${dayName(date)}
                                        </strong>
                                        <div class="muted">
                                            ${formatDate(date)}
                                        </div>
                                    </div>
                                    <strong>
                                        ${dayBookings.length}
                                        atendimento(s)
                                    </strong>
                                </div>
                                <div
                                    style="
                                        overflow-x:auto;
                                    "
                                >
                                    <div
                                        style="
                                            min-width:
                                                ${
                                                    75 +
                                                    columns * 250
                                                }px;
                                            display:grid;
                                            grid-template-columns:
                                                75px
                                                repeat(
                                                    ${columns},
                                                    minmax(
                                                        250px,
                                                        1fr
                                                    )
                                                );
                                            grid-auto-rows:
                                                140px;
                                        "
                                    >
                                        <div
                                            style="
                                                grid-column:1;
                                                grid-row:1;
                                                padding:12px 8px;
                                                text-align:center;
                                                font-size:11px;
                                                font-weight:700;
                                            "
                                        >
                                            HORA
                                        </div>
                                        ${headers}
                                        ${background.join('')}
                                        ${cards}
                                    </div>
                                </div>
                            </section>
                        `;
                    }
                )
                .join('');
    }
    /*
     * FILTROS
     */
    dateInput?.addEventListener(
        'change',
        carregarAgendaAdmin
    );
    professionalInput?.addEventListener(
        'change',
        carregarAgendaAdmin
    );
    todayButton?.addEventListener(
        'click',
        async () => {
            if (dateInput) {
                dateInput.value =
                    today();
            }
            await carregarAgendaAdmin();
        }
    );
    clearButton?.addEventListener(
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
    await carregarAgendaAdmin();
}
/* =========================================================
   NOVO AGENDAMENTO PELO ADMINISTRADOR
   ========================================================= */

async function novoAgendamentoAdmin() {

    if (!isAdmin()) {
        toast(
            'Acesso restrito ao administrador.'
        );
        return;
    }

    $('#adminBookingModal')?.remove();

    /* -------------------------
       BUSCAR CLIENTES
       ------------------------- */

    const {
        data: clients = [],
        error: clientsError
    } = await sb
        .from('profiles')
        .select(
            'id,name,phone,email,birth'
        )
        .eq(
            'role',
            'client'
        )
        .order(
            'name'
        );

    if (clientsError) {

        console.error(
            'Erro ao carregar clientes:',
            clientsError
        );

        toast(
            'Não foi possível carregar os clientes.'
        );

        return;
    }

    if (!clients.length) {

        toast(
            'Nenhum cliente cadastrado.'
        );

        return;
    }

    /* -------------------------
       GARANTIR SERVIÇOS
       ------------------------- */

    if (!services.length) {
        await loadServices();
    }

    if (!professionals.length) {
        await loadProfessionals();
    }

    /* -------------------------
       MODAL
       ------------------------- */

    const modal =
        document.createElement(
            'div'
        );

    modal.id =
        'adminBookingModal';

    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
        background:rgba(0,0,0,.70);
        overflow:auto;
    `;

    modal.innerHTML = `

        <div
            style="
                width:min(100%,560px);
                max-height:90vh;
                overflow:auto;
                background:var(--card,#fff);
                color:inherit;
                border-radius:18px;
                padding:24px;
                box-shadow:0 20px 70px rgba(0,0,0,.35);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:12px;
                    margin-bottom:20px;
                "
            >

                <div>

                    <h2
                        style="
                            margin:0 0 5px;
                        "
                    >
                        ➕ Novo Agendamento
                    </h2>

                    <p
                        class="muted"
                        style="margin:0;"
                    >
                        Agendar em nome do cliente
                    </p>

                </div>

                <button
                    type="button"
                    id="closeAdminBooking"
                    aria-label="Fechar"
                >
                    ✕
                </button>

            </div>


            <div
                style="
                    display:grid;
                    gap:14px;
                "
            >

                <!-- CLIENTE -->

                <div>

                    <label
                        for="adminBookingClient"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Cliente
                    </label>

                    <select
                        id="adminBookingClient"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                        <option value="">
                            Selecione o cliente
                        </option>

                        ${clients.map(client => `

                            <option
                                value="${client.id}"
                            >
                                ${client.name || 'Cliente sem nome'}
                                ${client.phone
                                    ? ' • ' + client.phone
                                    : ''
                                }
                            </option>

                        `).join('')}

                    </select>

                </div>


                <!-- SERVIÇO -->

                <div>

                    <label
                        for="adminBookingService"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Serviço
                    </label>

                    <select
                        id="adminBookingService"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                        <option value="">
                            Selecione o serviço
                        </option>

                        ${services
                            .filter(
                                service =>
                                    service.active !== false
                            )
                            .map(service => `

                                <option
                                    value="${service.id}"
                                >
                                    ${service.name}
                                    -
                                    ${money(service.price)}
                                    -
                                    ${Number(service.duration) || 30}
                                    min
                                </option>

                            `)
                            .join('')}

                    </select>

                </div>


                <!-- BARBEIRO -->

                <div>

                    <label
                        for="adminBookingProfessional"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Barbeiro
                    </label>

                    <select
                        id="adminBookingProfessional"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                        <option value="">
                            Selecione o barbeiro
                        </option>

                        ${professionals.map(professional => `

                            <option
                                value="${professional.id}"
                            >
                                ${professional.name}
                            </option>

                        `).join('')}

                    </select>

                </div>


                <!-- DATA -->

                <div>

                    <label
                        for="adminBookingDate"
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
                        id="adminBookingDate"
                        min="${today()}"
                        value="${today()}"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                </div>


                <!-- HORÁRIO -->

                <div>

                    <label
                        style="
                            display:block;
                            margin-bottom:8px;
                            font-weight:600;
                        "
                    >
                        Horário disponível
                    </label>

                    <div
                        id="adminBookingTimes"
                        style="
                            display:grid;
                            grid-template-columns:
                                repeat(
                                    auto-fit,
                                    minmax(90px,1fr)
                                );
                            gap:8px;
                        "
                    >

                        <p
                            class="muted"
                            style="
                                grid-column:1/-1;
                            "
                        >
                            Selecione serviço, barbeiro e data.
                        </p>

                    </div>

                </div>


                <!-- RESUMO -->

                <div
                    id="adminBookingSummary"
                    style="
                        display:none;
                        padding:14px;
                        border-radius:12px;
                        background:rgba(128,128,128,.10);
                    "
                >

                    <strong>
                        Resumo do agendamento
                    </strong>

                    <div
                        id="adminBookingSummaryText"
                        style="
                            margin-top:8px;
                        "
                    ></div>

                </div>


                <!-- BOTÕES FIXOS -->

<div
    id="adminBookingActions"
    style="
        position:sticky;
        bottom:0;
        z-index:10;
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin:18px -20px -20px;
        padding:14px 20px;
        border-top:1px solid rgba(128,128,128,.25);
        background:var(--card,#fff);
        box-shadow:0 -4px 12px rgba(0,0,0,.08);
    "
>

    <button
        type="button"
        id="cancelAdminBooking"
        style="
            min-width:110px;
            min-height:44px;
            padding:10px 16px;
            border:1px solid #999;
            border-radius:8px;
            background:#fff;
            color:#222;
            cursor:pointer;
            font-size:14px;
            font-weight:600;
        "
    >
        Cancelar
    </button>


    <button
        type="button"
        id="confirmAdminBooking"
        disabled
        style="
            min-width:190px;
            min-height:44px;
            padding:10px 16px;
            border:none;
            border-radius:8px;
            background:#111;
            color:#fff;
            cursor:not-allowed;
            opacity:.6;
            font-size:14px;
            font-weight:600;
        "
    >
        Confirmar Agendamento
    </button>

</div>
              



                

            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );


    let selectedTime =
        '';


    const closeModal =
        () => {
            modal.remove();
        };


    $('#closeAdminBooking')
        ?.addEventListener(
            'click',
            closeModal
        );

    $('#cancelAdminBooking')
        ?.addEventListener(
            'click',
            closeModal
        );


    modal.addEventListener(
        'click',
        e => {

            if (
                e.target ===
                modal
            ) {
                closeModal();
            }

        }
    );


    /* =====================================================
       ATUALIZAR HORÁRIOS
       ===================================================== */

    async function carregarHorariosAdmin() {

        selectedTime =
            '';

        const grid =
            $('#adminBookingTimes');

        const confirmButton =
            $('#confirmAdminBooking');

        const summary =
            $('#adminBookingSummary');

        if (confirmButton) {
            confirmButton.disabled =
                true;
        }

        if (summary) {
            summary.style.display =
                'none';
        }

        if (!grid) {
            return;
        }

        const serviceId =
            $('#adminBookingService')
                ?.value;

        const professionalId =
            $('#adminBookingProfessional')
                ?.value;

        const date =
            $('#adminBookingDate')
                ?.value;

        if (
            !serviceId ||
            !professionalId ||
            !date
        ) {

            grid.innerHTML = `
                <p
                    class="muted"
                    style="grid-column:1/-1;"
                >
                    Selecione serviço, barbeiro e data.
                </p>
            `;

            return;
        }


        const service =
            services.find(
                service =>
                    service.id ===
                    serviceId
            );

        const duration =
            Number(
                service?.duration
            ) || 30;


        grid.innerHTML = `
            <p
                class="muted"
                style="grid-column:1/-1;"
            >
                Verificando horários...
            </p>
        `;


        /* -------------------------
           BUSCAR AGENDAMENTOS
           ------------------------- */

        const {
            data: bookings = [],
            error
        } = await sb
            .from('bookings')
            .select(
                'booking_time,service_id,status'
            )
            .eq(
                'booking_date',
                date
            )
            .eq(
                'professional_id',
                professionalId
            )
            .neq(
                'status',
                'cancelled'
            );


        if (error) {

            console.error(
                'Erro ao verificar horários:',
                error
            );

            grid.innerHTML = `
                <p
                    class="muted"
                    style="grid-column:1/-1;"
                >
                    Não foi possível verificar os horários.
                </p>
            `;

            return;
        }


        /* -------------------------
           HORÁRIOS OCUPADOS
           ------------------------- */

        const occupied =
            bookings.map(
                booking => {

                    const start =
                        timeToMinutes(
                            String(
                                booking.booking_time
                            ).slice(0,5)
                        );

                    const bookedService =
                        services.find(
                            service =>
                                service.id ===
                                booking.service_id
                        );

                    const bookedDuration =
                        Number(
                            bookedService?.duration
                        ) || 30;

                    return {
                        start,
                        end:
                            start +
                            bookedDuration
                    };

                }
            );


        /* -------------------------
           HORÁRIOS DISPONÍVEIS
           ------------------------- */

        const available =
            slots().filter(
                time => {

                    const start =
                        timeToMinutes(
                            time
                        );

                    const end =
                        start +
                        duration;


                    /* Não permitir horário
                       passado no dia atual */

                    if (
                        date ===
                        today()
                    ) {

                        const now =
                            new Date();

                        const current =
                            now.getHours() *
                                60 +
                            now.getMinutes();

                        if (
                            start <=
                            current
                        ) {
                            return false;
                        }

                    }


                    /* Verificar conflito */

                    const conflict =
                        occupied.some(
                            booked =>
                                start <
                                    booked.end &&
                                end >
                                    booked.start
                        );

                    return !conflict;

                }
            );


        if (!available.length) {

            grid.innerHTML = `
                <p
                    class="muted"
                    style="grid-column:1/-1;"
                >
                    Nenhum horário disponível para esta data.
                </p>
            `;

            return;
        }


        grid.innerHTML =
            available.map(
                time => `

                    <button
                        type="button"
                        class="admin-time-option"
                        data-admin-time="${time}"
                    >
                        ${time}
                    </button>

                `
            ).join('');


            $$('.admin-time-option')
    .forEach(
        button => {

            button.addEventListener(
                'click',
                () => {

                    /* =================================
                       RESETAR TODOS OS HORÁRIOS
                       ================================= */

                    $$('.admin-time-option')
                        .forEach(
                            item => {

                                item.classList.remove(
                                    'selected'
                                );

                                item.style.background =
                                    '#f5f5f5';

                                item.style.color =
                                    '#222';

                                item.style.border =
                                    '1px solid #999';

                                item.style.fontWeight =
                                    '500';

                                item.style.boxShadow =
                                    'none';

                                item.textContent =
                                    item.dataset.adminTime;

                            }
                        );


                    /* =================================
                       SELECIONAR O HORÁRIO CLICADO
                       ================================= */

                    button.classList.add(
                        'selected'
                    );


                    selectedTime =
                        button.dataset.adminTime;


                    /* =================================
                       ALTERAR VISUAL
                       ================================= */

                    button.style.background =
                        '#198754';

                    button.style.color =
                        '#ffffff';

                    button.style.border =
                        '2px solid #146c43';

                    button.style.fontWeight =
                        '700';

                    button.style.boxShadow =
                        '0 0 0 3px rgba(25,135,84,.20)';


                    /* =================================
                       MOSTRAR CHECK
                       ================================= */

                    button.textContent =
                        '✓ ' + selectedTime;


                    /* =================================
                       ATUALIZAR RESUMO
                       ================================= */

                    atualizarResumoAdmin();


                    /* =================================
                       GARANTIR BOTÃO CONFIRMAR
                       ================================= */

                    const confirmButton =
                        $('#confirmAdminBooking');


                    if (confirmButton) {

                        confirmButton.disabled =
                            false;

                        confirmButton.style.cursor =
                            'pointer';

                        confirmButton.style.opacity =
                            '1';

                    }


                    console.log(
                        'Horário selecionado:',
                        selectedTime
                    );

                }
            );

        }
    );

    }


    /* =====================================================
       RESUMO
       ===================================================== */

    function atualizarResumoAdmin() {

        const client =
            clients.find(
                item =>
                    item.id ===
                    $('#adminBookingClient')
                        ?.value
            );

        const service =
            services.find(
                item =>
                    item.id ===
                    $('#adminBookingService')
                        ?.value
            );

        const professional =
            professionals.find(
                item =>
                    item.id ===
                    $('#adminBookingProfessional')
                        ?.value
            );

        const date =
            $('#adminBookingDate')
                ?.value;

        const summary =
            $('#adminBookingSummary');

        const text =
            $('#adminBookingSummaryText');

        const confirmButton =
            $('#confirmAdminBooking');


        if (
            !client ||
            !service ||
            !professional ||
            !date ||
            !selectedTime
        ) {

            if (summary) {
                summary.style.display =
                    'none';
            }

            if (confirmButton) {
                confirmButton.disabled =
                    true;
            }

            return;
        }


        const [
            year,
            month,
            day
        ] =
            date.split('-');


        if (text) {

            text.innerHTML = `

                <div>
                    <strong>Cliente:</strong>
                    ${client.name || '-'}
                </div>

                <div>
                    <strong>Serviço:</strong>
                    ${service.name}
                </div>

                <div>
                    <strong>Barbeiro:</strong>
                    ${professional.name}
                </div>

                <div>
                    <strong>Data:</strong>
                    ${day}/${month}/${year}
                </div>

                <div>
                    <strong>Horário:</strong>
                    ${selectedTime}
                </div>

            `;

        }


        if (summary) {
            summary.style.display =
                'block';
        }

        if (confirmButton) {
            confirmButton.disabled =
                false;
        }

    }


    /* =====================================================
       EVENTOS DOS CAMPOS
       ===================================================== */

    $('#adminBookingService')
        ?.addEventListener(
            'change',
            async () => {

                selectedTime =
                    '';

                await carregarHorariosAdmin();

            }
        );


    $('#adminBookingProfessional')
        ?.addEventListener(
            'change',
            async () => {

                selectedTime =
                    '';

                await carregarHorariosAdmin();

            }
        );


    $('#adminBookingDate')
        ?.addEventListener(
            'change',
            async () => {

                selectedTime =
                    '';

                await carregarHorariosAdmin();

            }
        );


    $('#adminBookingClient')
        ?.addEventListener(
            'change',
            () => {

                atualizarResumoAdmin();

            }
        );


    /* =====================================================
       CONFIRMAR
       ===================================================== */

    $('#confirmAdminBooking')
        ?.addEventListener(
            'click',
            async () => {

                const clientId =
                    $('#adminBookingClient')
                        ?.value;

                const serviceId =
                    $('#adminBookingService')
                        ?.value;

                const professionalId =
                    $('#adminBookingProfessional')
                        ?.value;

                const date =
                    $('#adminBookingDate')
                        ?.value;


                if (
                    !clientId ||
                    !serviceId ||
                    !professionalId ||
                    !date ||
                    !selectedTime
                ) {

                    toast(
                        'Preencha todos os dados do agendamento.'
                    );

                    return;
                }


                const button =
                    $('#confirmAdminBooking');


                if (button) {

                    button.disabled =
                        true;

                    button.textContent =
                        'Agendando...';

                }


                /* -------------------------
                   VERIFICAR NOVAMENTE
                   ------------------------- */

                const {
                    data: existing,
                    error:
                        checkError
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
                        selectedTime +
                            ':00'
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

                    if (button) {
                        button.disabled =
                            false;
                        button.textContent =
                            'Confirmar Agendamento';
                    }

                    return;
                }


                if (existing) {

                    toast(
                        'Esse horário acabou de ser ocupado. Escolha outro.'
                    );

                    await carregarHorariosAdmin();

                    if (button) {
                        button.disabled =
                            true;
                        button.textContent =
                            'Confirmar Agendamento';
                    }

                    return;
                }


                /* -------------------------
                   GRAVAR AGENDAMENTO
                   ------------------------- */

                const {
                    error
                } = await sb
                    .from('bookings')
                    .insert({

                        user_id:
                            clientId,

                        service_id:
                            serviceId,

                        professional_id:
                            professionalId,

                        booking_date:
                            date,

                        booking_time:
                            selectedTime +
                            ':00',

                        status:
                            'confirmed',

                        notes:
                            'Agendamento realizado pelo administrador'

                    });


                if (error) {

                    console.error(
                        'Erro ao criar agendamento pelo administrador:',
                        error
                    );

                    toast(
                        error.message ||
                        'Não foi possível criar o agendamento.'
                    );

                    if (button) {
                        button.disabled =
                            false;
                        button.textContent =
                            'Confirmar Agendamento';
                    }

                    return;
                }


                toast(
                    'Agendamento realizado com sucesso!'
                );


                closeModal();


                /* Atualizar a agenda */

                await agenda();

            }
        );


    /* Carregar horários inicialmente */

    await carregarHorariosAdmin();

}
/* =========================================================
   AGENDA ADMIN
   ========================================================= */
async function agenda() {
    /* =========================================================
       ADMINISTRADOR
       ========================================================= */
    if (isAdmin()) {
        await loadSettings();
        await loadProfessionals();
        const page = $('#page-agenda');
         if (isAdmin()) {
        await agendaAdmin();
        return;
        }
        /*
         * Para o ADMIN, a página Agenda deixa de ser
         * a tela "Agende seu horário" do cliente.
         *
         * O administrador passa a visualizar
         * todos os agendamentos.
         */
        page.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Agenda</h1>
                    <p class="muted">
                        Visualização de todos os agendamentos da barbearia.
                    </p>
                </div>
            </div>
            <!-- FILTROS -->
            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(180px, 1fr)
                        );
                    gap:12px;
                    margin:20px 0;
                "
            >
                <!-- DATA -->
                <div>
                    <label
                        for="adminAgendaDate"
                        style="
                            display:block;
                            margin-bottom:6px;
                        "
                    >
                        Filtrar por data
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
                <!-- PROFISSIONAL -->
                <div>
                    <label
                        for="adminAgendaProfessional"
                        style="
                            display:block;
                            margin-bottom:6px;
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
                <!-- LIMPAR FILTROS -->
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
                    margin-bottom:14px;
                "
            ></div>
            <!-- LISTA -->
            <div
                id="adminAgendaList"
                style="
                    display:grid;
                    gap:12px;
                "
            >
                <p class="muted">
                    Carregando agendamentos...
                </p>
            </div>
        `;
        /* =====================================================
           PROFISSIONAIS
           ===================================================== */
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
        /* =====================================================
           CARREGAR AGENDAMENTOS
           ===================================================== */
        async function carregarAgendaAdmin() {
            const list =
                $('#adminAgendaList');
            const summary =
                $('#adminAgendaSummary');
            if (!list) {
                return;
            }
            list.innerHTML = `
                <p class="muted">
                    Carregando agendamentos...
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
                            ascending: false
                        }
                    )
                    .order(
                        'booking_time',
                        {
                            ascending: false
                        }
                    );
            const filterDate =
                dateInput?.value || '';
            const filterProfessional =
                professionalInput?.value || '';
            /* FILTRO POR DATA */
            if (filterDate) {
                query =
                    query.eq(
                        'booking_date',
                        filterDate
                    );
            }
            /* FILTRO POR PROFISSIONAL */
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
            /* ERRO */
            if (error) {
                console.error(
                    'Erro ao carregar agendamentos:',
                    error
                );
                list.innerHTML = `
                    <div class="empty-state">
                        <p>
                            Não foi possível carregar os agendamentos.
                        </p>
                        <small class="muted">
                            ${error.message || ''}
                        </small>
                    </div>
                `;
                if (summary) {
                    summary.textContent = '';
                }
                return;
            }
            /* RESUMO */
            if (summary) {
                summary.innerHTML = `
                    <strong>
                        ${bookings.length}
                        agendamento(s)
                    </strong>
                    ${
                        filterDate
                            ? `
                                <span class="muted">
                                    —
                                    ${filterDate
                                        .split('-')
                                        .reverse()
                                        .join('/')}
                                </span>
                            `
                            : `
                                <span class="muted">
                                    —
                                    todos os períodos
                                </span>
                            `
                    }
                `;
            }
            /* NENHUM AGENDAMENTO */
            if (!bookings.length) {
                list.innerHTML = `
                    <div class="empty-state">
                        <p>
                            Nenhum agendamento encontrado.
                        </p>
                    </div>
                `;
                return;
            }
            /* =================================================
               IDs DOS SERVIÇOS
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
            /* =================================================
               IDs DOS CLIENTES
               ================================================= */
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
            /* =================================================
               IDs DOS PROFISSIONAIS
               ================================================= */
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
            /* =================================================
               SERVIÇOS
               ================================================= */
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
                            service => [
                                service.id,
                                service
                            ]
                        )
                    );
            }
            /* =================================================
               CLIENTES
               ================================================= */
            if (userIds.length) {
                const {
                    data: profileData = []
                } = await sb
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
            /* =================================================
               PROFISSIONAIS
               ================================================= */
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
               STATUS
               ================================================= */
            function statusInfo(status) {
                switch (status) {
                    case 'in_progress':
                        return {
                            text:
                                'Em atendimento',
                            className:
                                'progress'
                        };
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
               FORMATAR DATA
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
            /* =================================================
               MONTAR LISTA
               ================================================= */
            list.innerHTML =
                bookings.map(
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
                                ?.slice(0, 5) ||
                            '--:--';
                        const isCancelled =
                            booking.status ===
                            'cancelled';
                        return `
                            <div
                                class="slot-card"
                                style="
                                    padding:16px;
                                    border-radius:12px;
                                "
                            >
                                <!-- CABEÇALHO -->
                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        align-items:flex-start;
                                        gap:12px;
                                        flex-wrap:wrap;
                                    "
                                >
                                    <div>
                                        <div
                                            style="
                                                font-size:17px;
                                                font-weight:700;
                                            "
                                        >
                                            ${clientName}
                                        </div>
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
                                    <span
                                        class="${status.className}"
                                    >
                                        ${status.text}
                                    </span>
                                </div>
                                <!-- DADOS -->
                                <div
                                    style="
                                        display:grid;
                                        grid-template-columns:
                                            repeat(
                                                auto-fit,
                                                minmax(140px, 1fr)
                                            );
                                        gap:12px;
                                        margin-top:14px;
                                    "
                                >
                                    <div>
                                        <small class="muted">
                                            Data
                                        </small>
                                        <div>
                                            📅
                                            ${formatDate(
                                                booking.booking_date
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Horário
                                        </small>
                                        <div>
                                            🕐
                                            ${time}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Serviço
                                        </small>
                                        <div>
                                            ✂️
                                            ${serviceName}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Profissional
                                        </small>
                                        <div>
                                            👤
                                            ${professionalName}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Duração
                                        </small>
                                        <div>
                                            ⏱️
                                            ${duration} min
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Valor
                                        </small>
                                        <div>
                                            💰
                                            ${price}
                                        </div>
                                    </div>
                                </div>
                                <!-- AÇÕES -->
                                ${
                                    !isCancelled
                                        ? `
                                            <div
                                                style="
                                                    display:flex;
                                                    gap:6px;
                                                    flex-wrap:wrap;
                                                    margin-top:14px;
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
                        `;
                    }
                ).join('');
        }
        /* =====================================================
           EVENTOS DOS FILTROS
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
        /* CARREGAR */
        await carregarAgendaAdmin();
        return;
    }
    /* =========================================================
       CLIENTE
       ========================================================= */
    /*
     * Daqui para baixo permanece o código original
     * da agenda do cliente.
     */
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
                booking_date,
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
    /*
     * O restante do código original do CLIENTE
     * deve permanecer abaixo daqui.
     */
}
/* =========================================================
   TODOS OS AGENDAMENTOS - ADMIN
   ========================================================= */
async function todosAgendamentosAdmin() {
    if (!isAdmin()) {
        return;
    }
    const grid =
        $('#agendaGrid');
    if (!grid) {
        return;
    }
    grid.innerHTML = `
        <p class="muted">
            Carregando todos os agendamentos...
        </p>
    `;
    const {
        data: bookings = [],
        error
    } =
        await sb
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
                    ascending: false
                }
            )
            .order(
                'booking_time',
                {
                    ascending: false
                }
            );
    if (error) {
        console.error(
            'Erro ao carregar todos os agendamentos:',
            error
        );
        grid.innerHTML = `
            <div class="empty-state">
                <p>
                    Não foi possível carregar os agendamentos.
                </p>
                <small class="muted">
                    ${error.message || ''}
                </small>
            </div>
        `;
        return;
    }
    if (!bookings.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <p>
                    Nenhum agendamento encontrado.
                </p>
            </div>
        `;
        return;
    }
    /* =========================================================
       SERVIÇOS
       ========================================================= */
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
            data: servicesData = []
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
                servicesData.map(
                    service => [
                        service.id,
                        service
                    ]
                )
            );
    }
    /* =========================================================
       CLIENTES
       ========================================================= */
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
            data: profilesData = []
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
                profilesData.map(
                    profile => [
                        profile.id,
                        profile
                    ]
                )
            );
    }
    /* =========================================================
       PROFISSIONAIS
       ========================================================= */
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
            data: professionalsData = []
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
                professionalsData.map(
                    professional => [
                        professional.id,
                        professional
                    ]
                )
            );
    }
    /* =========================================================
       STATUS
       ========================================================= */
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
    /* =========================================================
       FORMATAR DATA
       ========================================================= */
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
        return `
            ${day}/${month}/${year}
        `;
    }
    /* =========================================================
       LISTA
       ========================================================= */
    grid.innerHTML = `
        <div
            style="
                display:grid;
                gap:12px;
                width:100%;
            "
        >
            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    flex-wrap:wrap;
                    gap:10px;
                    margin-bottom:8px;
                "
            >
                <div>
                    <h3 style="margin:0;">
                        Todos os agendamentos
                    </h3>
                    <small class="muted">
                        ${bookings.length}
                        agendamento(s) encontrado(s)
                    </small>
                </div>
            </div>
            ${
                bookings.map(
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
                        const time =
                            booking.booking_time
                                ?.slice(0, 5) ||
                            '--:--';
                        const clientName =
                            client?.name ||
                            'Cliente';
                        const phone =
                            client?.phone ||
                            '';
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
                        const professionalName =
                            professional?.name ||
                            'Não informado';
                        return `
                            <div
                                class="agenda-row"
                                style="
                                    padding:16px;
                                    border:1px solid
                                        rgba(128,128,128,.20);
                                    border-radius:12px;
                                    display:grid;
                                    gap:8px;
                                "
                            >
                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        align-items:flex-start;
                                        gap:12px;
                                        flex-wrap:wrap;
                                    "
                                >
                                    <div>
                                        <strong>
                                            ${clientName}
                                        </strong>
                                        ${
                                            phone
                                                ? `
                                                    <small
                                                        style="
                                                            display:block;
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
                                        display:grid;
                                        grid-template-columns:
                                            repeat(
                                                auto-fit,
                                                minmax(140px, 1fr)
                                            );
                                        gap:8px;
                                    "
                                >
                                    <div>
                                        <small class="muted">
                                            Data
                                        </small>
                                        <div>
                                            📅
                                            ${formatDate(
                                                booking.booking_date
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Horário
                                        </small>
                                        <div>
                                            🕐
                                            ${time}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Serviço
                                        </small>
                                        <div>
                                            ✂️
                                            ${serviceName}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Profissional
                                        </small>
                                        <div>
                                            👤
                                            ${professionalName}
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Duração
                                        </small>
                                        <div>
                                            ⏱️
                                            ${duration} min
                                        </div>
                                    </div>
                                    <div>
                                        <small class="muted">
                                            Valor
                                        </small>
                                        <div>
                                            💰
                                            ${price}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                ).join('')
            }
        </div>
    `;
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
    const serviceId =
        $('#clientService')?.value;
    const professionalId =
        $('#clientProfessional')?.value;
    const date =
        $('#clientDate')?.value;
    const grid =
        $('#clientTimeGrid');
    if (!grid) {
        return;
    }
    if (
        !serviceId ||
        !professionalId ||
        !date
    ) {
        grid.innerHTML =
            '<p class="muted">Selecione serviço, profissional e data.</p>';
        if ($('#bookingSummary')) {
            $('#bookingSummary')
                .classList
                .add('hidden');
        }
        return;
    }
    const service =
        services.find(
            s =>
                s.id === serviceId
        );
    if (!service) {
        grid.innerHTML =
            '<p class="muted">Serviço não encontrado.</p>';
        return;
    }
    const duration =
        Number(
            service.duration
        ) || 30;
    const {
        data: bookings = [],
        error
    } = await sb
        .from('bookings')
        .select(`
            booking_time,
            status,
            service_id
        `)
        .eq(
            'professional_id',
            professionalId
        )
        .eq(
            'booking_date',
            date
        )
        .neq(
            'status',
            'cancelled'
        );
    if (error) {
        console.error(
            'Erro ao carregar horários:',
            error
        );
        grid.innerHTML =
            '<p class="muted">Não foi possível carregar os horários.</p>';
        return;
    }
    const occupied =
        [];
    for (
        const booking of bookings
    ) {
        if (!booking.booking_time) {
            continue;
        }
        const start =
            timeToMinutes(
                booking.booking_time
                    .slice(0, 5)
            );
        const bookedService =
            services.find(
                s =>
                    s.id ===
                    booking.service_id
            );
        const bookedDuration =
            Number(
                bookedService?.duration
            ) || 30;
        const end =
            start +
            bookedDuration;
        occupied.push({
            start,
            end
        });
    }
    const [
        closingHour,
        closingMinute
    ] =
        settings.end_time
            .slice(0, 5)
            .split(':')
            .map(Number);
    const closing =
        closingHour * 60 +
        closingMinute;
    const available =
        slots().filter(time => {
            const start =
                timeToMinutes(time);
            const end =
                start +
                duration;
            if (end > closing) {
                return false;
            }
            if (date === today()) {
                const now =
                    new Date();
                const current =
                    now.getHours() * 60 +
                    now.getMinutes();
                if (start <= current) {
                    return false;
                }
            }
            const conflict =
                occupied.some(
                    booked => {
                        return (
                            start <
                            booked.end &&
                            end >
                            booked.start
                        );
                    }
                );
            return !conflict;
        });
    if (!available.length) {
        grid.innerHTML =
            '<p class="muted">Nenhum horário disponível para esta data.</p>';
        if ($('#bookingSummary')) {
            $('#bookingSummary')
                .classList
                .add('hidden');
        }
        return;
    }
    grid.innerHTML =
        available.map(time => `
            <button
                type="button"
                class="time-option"
                data-booking-time="${time}"
            >
                ${time}
            </button>
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
/* =========================================================
   CLIENTE - CRIAR AGENDAMENTO
   ========================================================= */

async function createBooking() {

    console.log(
        'INICIANDO AGENDAMENTO DO CLIENTE'
    );

    try {

        /* ============================
           VERIFICAR PERFIL
           ============================ */

        if (!isClient()) {

            alert(
                'Acesso não permitido.\n\n' +
                'O usuário precisa estar logado como cliente.'
            );

            console.error(
                'createBooking: usuário não é cliente.'
            );

            return;
        }


        /* ============================
           PEGAR DADOS DA TELA
           ============================ */

        const serviceId =
            $('#clientService')?.value;

        const professionalId =
            $('#clientProfessional')?.value;

        const date =
            $('#clientDate')?.value;

        const time =
            $('#summaryTime')?.textContent
                ?.trim();


        console.log(
            'DADOS DO AGENDAMENTO:',
            {
                serviceId,
                professionalId,
                date,
                time
            }
        );


        /* ============================
           VALIDAR DADOS
           ============================ */

        if (
            !serviceId ||
            !professionalId ||
            !date ||
            !time
        ) {

            alert(
                'Para confirmar o agendamento, ' +
                'selecione:\n\n' +
                '• Serviço\n' +
                '• Barbeiro\n' +
                '• Data\n' +
                '• Horário'
            );

            return;
        }


        /* ============================
           USUÁRIO LOGADO
           ============================ */

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

            alert(
                'Sua sessão não está ativa.\n\n' +
                'Faça login novamente.'
            );

            return;
        }


        console.log(
            'USUÁRIO:',
            authUser.id,
            authUser.email
        );


        /* ============================
           VERIFICAR HORÁRIO
           ============================ */

        const bookingTime =
            time.length === 5
                ? time + ':00'
                : time;


        console.log(
            'VERIFICANDO HORÁRIO:',
            bookingTime
        );


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
                bookingTime
            )
            .neq(
                'status',
                'cancelled'
            )
            .limit(1)
            .maybeSingle();


        if (checkError) {

            console.error(
                'ERRO AO VERIFICAR HORÁRIO:',
                checkError
            );

            alert(
                'Não foi possível verificar o horário.\n\n' +
                'Erro Supabase:\n' +
                checkError.message
            );

            return;
        }


        if (existing) {

            alert(
                'Este horário já foi ocupado.\n\n' +
                'Escolha outro horário.'
            );

            await loadClientTimes();

            return;
        }


        /* ============================
           GRAVAR AGENDAMENTO
           ============================ */

        console.log(
            'GRAVANDO AGENDAMENTO...'
        );


        const {
            data: newBooking,
            error: insertError
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
                    bookingTime,

                status:
                    'confirmed',

                notes:
                    null

            })
            .select()
            .single();


        /* ============================
           ERRO AO GRAVAR
           ============================ */

        if (insertError) {

            console.error(
                'ERRO AO CRIAR AGENDAMENTO:',
                insertError
            );

            alert(
                'Não foi possível realizar o agendamento.\n\n' +
                'Código: ' +
                (
                    insertError.code ||
                    'N/A'
                ) +
                '\n\n' +
                'Mensagem:\n' +
                (
                    insertError.message ||
                    'Erro desconhecido.'
                )
            );

            return;
        }


        console.log(
            'AGENDAMENTO CRIADO:',
            newBooking
        );


        /* ============================
           SUCESSO
           ============================ */

        alert(
            '✅ AGENDAMENTO REALIZADO!\n\n' +

            'Serviço: ' +
            (
                services.find(
                    s =>
                        s.id ===
                        serviceId
                )?.name ||
                '-'
            ) +

            '\nBarbeiro: ' +
            (
                professionals.find(
                    p =>
                        p.id ===
                        professionalId
                )?.name ||
                '-'
            ) +

            '\nData: ' +
            date.split('-').reverse().join('/') +

            '\nHorário: ' +
            time
        );


        /* ============================
           LIMPAR FORMULÁRIO
           ============================ */

        if ($('#clientService')) {

            $('#clientService').value =
                '';
        }


        if ($('#clientProfessional')) {

            $('#clientProfessional').value =
                '';
        }


        if ($('#bookingSummary')) {

            $('#bookingSummary')
                .classList
                .add('hidden');
        }


        if ($('#summaryService')) {

            $('#summaryService')
                .textContent =
                '-';
        }


        if ($('#summaryProfessional')) {

            $('#summaryProfessional')
                .textContent =
                '-';
        }


        if ($('#summaryTime')) {

            $('#summaryTime')
                .textContent =
                '';
        }


        if ($('#clientTimeGrid')) {

            $('#clientTimeGrid').innerHTML =
                `
                    <p class="muted">
                        Selecione serviço,
                        profissional e data.
                    </p>
                `;
        }


        /* ============================
           ATUALIZAR MEUS AGENDAMENTOS
           ============================ */

        await consultarAgenda();


    } catch (error) {

        console.error(
            'ERRO INESPERADO NO AGENDAMENTO:',
            error
        );

        alert(
            'Ocorreu um erro ao realizar o agendamento.\n\n' +
            (
                error?.message ||
                error
            )
        );

    }

}/*======================================================
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
        .order(
            'booking_date',
            {
                ascending: false
            }
        )
        .order(
            'booking_time',
            {
                ascending: false
            }
        );
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
        professionalMap =
            new Map(
                professionalData.map(
                    p => [
                        p.id,
                        p
                    ]
                )
            );
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
        .eq('role', 'client')
        .order('name');

    if (error) {

        console.error(
            'Erro ao carregar clientes:',
            error
        );

        if ($('#clientList')) {

            $('#clientList').innerHTML =
                '<p class="muted">Não foi possível carregar os clientes.</p>';

        }

        return;
    }

    window.allClients = data || [];

    renderClients(
        data || []
    );
}


/* =========================================================
   RENDERIZAR CLIENTES
   ========================================================= */

function renderClients(data) {

    if (!isAdmin()) {
        return;
    }

    if (!$('#clientList')) {
        return;
    }

    if (!data || !data.length) {

        $('#clientList').innerHTML = `
            <p class="muted">
                Nenhum cliente cadastrado.
            </p>
        `;

        return;
    }


    $('#clientList').innerHTML = `

        <div
            style="
                overflow-x:auto;
                width:100%;
            "
        >

            <table class="table">

                <thead>

                    <tr>

                        <th>
                            Nome
                        </th>

                        <th>
                            WhatsApp
                        </th>

                        <th>
                            Nascimento
                        </th>

                        <th>
                            E-mail
                        </th>

                        <th>
                            Ações
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(client => `

                        <tr>

                            <td>
                                ${client.name || '-'}
                            </td>


                            <td>
                                ${client.phone || '-'}
                            </td>


                            <td>

                                ${
                                    client.birth
                                        ? new Date(
                                            client.birth +
                                            'T12:00:00'
                                        ).toLocaleDateString(
                                            'pt-BR'
                                        )
                                        : '-'
                                }

                            </td>


                            <td>
                                ${client.email || '-'}
                            </td>


                            <td>

                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                        flex-wrap:wrap;
                                    "
                                >

                                    <button
                                        type="button"
                                        data-client-edit="${client.id}"
                                    >
                                        ✏️ Editar
                                    </button>


                                    <button
                                        type="button"
                                        data-client-bookings="${client.id}"
                                    >
                                        📅 Agendamentos
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `).join('')}

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   EDITAR CLIENTE
   ========================================================= */

async function editarCliente(clientId) {

    if (!isAdmin()) {

        toast(
            'Acesso restrito ao administrador.'
        );

        return;
    }


    if (!clientId) {

        toast(
            'Cliente não informado.'
        );

        return;
    }


    const client =

        (window.allClients || [])
            .find(
                item =>
                    String(item.id) ===
                    String(clientId)
            );


    if (!client) {

        console.error(
            'Cliente não encontrado:',
            clientId
        );

        toast(
            'Cliente não encontrado.'
        );

        return;
    }


    /* -------------------------
       REMOVER MODAL ANTIGO
       ------------------------- */

    $('#editClientModal')?.remove();


    /* -------------------------
       CRIAR MODAL
       ------------------------- */

    const modal =
        document.createElement('div');

    modal.id =
        'editClientModal';


    modal.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.65);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:9999;
        padding:20px;
    `;


    modal.innerHTML = `

        <div
            style="
                background:#fff;
                color:#222;
                width:100%;
                max-width:500px;
                max-height:90vh;
                overflow:auto;
                border-radius:14px;
                padding:24px;
                box-sizing:border-box;
                box-shadow:0 20px 60px rgba(0,0,0,.30);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:20px;
                "
            >

                <h2
                    style="
                        margin:0;
                    "
                >
                    Editar Cliente
                </h2>


                <button
                    type="button"
                    id="closeEditClientModal"
                >
                    ✕
                </button>

            </div>


            <div
                style="
                    display:grid;
                    gap:14px;
                "
            >

                <div>

                    <label>
                        Nome
                    </label>

                    <input
                        type="text"
                        id="editClientName"
                        value="${client.name || ''}"
                    >

                </div>


                <div>

                    <label>
                        WhatsApp
                    </label>

                    <input
                        type="text"
                        id="editClientPhone"
                        value="${client.phone || ''}"
                    >

                </div>


                <div>

                    <label>
                        E-mail
                    </label>

                    <input
                        type="email"
                        id="editClientEmail"
                        value="${client.email || ''}"
                    >

                </div>


                <div>

                    <label>
                        Data de nascimento
                    </label>

                    <input
                        type="date"
                        id="editClientBirth"
                        value="${client.birth || ''}"
                    >

                </div>


                <div
                    style="
                        display:flex;
                        gap:10px;
                        justify-content:flex-end;
                        margin-top:10px;
                    "
                >

                    <button
                        type="button"
                        id="cancelEditClient"
                    >
                        Cancelar
                    </button>


                    <button
                        type="button"
                        id="saveEditClient"
                    >
                        Salvar alterações
                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(modal);
const cancelButton =
    $('#cancelAdminBooking');

if (cancelButton) {
    cancelButton.disabled = false;
}

    /* -------------------------
       FECHAR
       ------------------------- */

    const fechar = () => {

        modal.remove();

    };


    $('#closeEditClientModal')
        .onclick = fechar;


    $('#cancelEditClient')
        .onclick = fechar;


    /* -------------------------
       SALVAR
       ------------------------- */

    $('#saveEditClient').onclick =
        async () => {

            const name =
                $('#editClientName')
                    ?.value
                    .trim() || '';


            const phone =
                $('#editClientPhone')
                    ?.value
                    .trim() || '';


            const email =
                $('#editClientEmail')
                    ?.value
                    .trim() || '';


            const birth =
                $('#editClientBirth')
                    ?.value || null;


            if (!name) {

                toast(
                    'Informe o nome do cliente.'
                );

                return;
            }


            const button =
                $('#saveEditClient');


            if (button) {

                button.disabled = true;

                button.textContent =
                    'Salvando...';

            }


            const {
                error
            } = await sb

                .from('profiles')

                .update({

                    name,

                    phone,

                    email,

                    birth

                })

                .eq(
                    'id',
                    clientId
                );


            if (error) {

                console.error(
                    'Erro ao atualizar cliente:',
                    error
                );


                toast(
                    error.message ||
                    'Não foi possível atualizar o cliente.'
                );


                if (button) {

                    button.disabled = false;

                    button.textContent =
                        'Salvar alterações';

                }

                return;
            }


            toast(
                'Cliente atualizado com sucesso!'
            );


            fechar();


            await loadClients();

        };
}


/* =========================================================
   VISUALIZAR AGENDAMENTOS DO CLIENTE
   ========================================================= */

async function visualizarAgendamentosCliente(clientId) {

    if (!isAdmin()) {

        toast(
            'Acesso restrito ao administrador.'
        );

        return;
    }


    if (!clientId) {

        toast(
            'Cliente não informado.'
        );

        return;
    }


    const client =

        (window.allClients || [])
            .find(
                item =>
                    String(item.id) ===
                    String(clientId)
            );


    if (!client) {

        toast(
            'Cliente não encontrado.'
        );

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
            professional_id
        `)

        .eq(
            'user_id',
            clientId
        )

        .order(
            'booking_date',
            {
                ascending:false
            }
        )

        .order(
            'booking_time',
            {
                ascending:false
            }
        );


    if (error) {

        console.error(
            'Erro ao carregar agendamentos do cliente:',
            error
        );


        toast(
            error.message ||
            'Não foi possível carregar os agendamentos.'
        );

        return;
    }


    /* -------------------------
       SERVIÇOS
       ------------------------- */

    const serviceIds = [

        ...new Set(

            bookings

                .map(
                    booking =>
                        booking.service_id
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
                    service => [
                        service.id,
                        service
                    ]
                )

            );
    }


    /* -------------------------
       PROFISSIONAIS
       ------------------------- */

    const professionalIds = [

        ...new Set(

            bookings

                .map(
                    booking =>
                        booking.professional_id
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


    /* -------------------------
       REMOVER MODAL ANTIGO
       ------------------------- */

    $('#clientBookingsModal')?.remove();


    /* -------------------------
       FUNÇÕES AUXILIARES
       ------------------------- */

    function formatDate(date) {

        if (!date) {
            return '-';
        }


        const parts =
            String(date).split('-');


        if (parts.length !== 3) {
            return date;
        }


        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }


    function statusInfo(status) {

        switch (status) {

            case 'completed':

                return {
                    text:'Concluído',
                    className:'ok'
                };


            case 'cancelled':

                return {
                    text:'Cancelado',
                    className:'cancel'
                };


            case 'in_progress':

                return {
                    text:'Em atendimento',
                    className:'progress'
                };


            default:

                return {
                    text:'Confirmado',
                    className:'ok'
                };
        }
    }


    /* -------------------------
       CRIAR MODAL
       ------------------------- */

    const modal =
        document.createElement('div');

    modal.id =
        'clientBookingsModal';


    modal.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.65);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:9999;
        padding:20px;
    `;


    const rows = bookings.length

        ? bookings.map(booking => {

            const service =
                serviceMap.get(
                    booking.service_id
                );


            const professional =
                professionalMap.get(
                    booking.professional_id
                );


            const status =
                statusInfo(
                    booking.status
                );


            return `

                <div
                    style="
                        border:1px solid #ddd;
                        border-radius:10px;
                        padding:14px;
                        margin-bottom:10px;
                    "
                >

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <strong>
                            ${formatDate(
                                booking.booking_date
                            )}
                            às
                            ${
                                booking.booking_time
                                    ? booking.booking_time.slice(0,5)
                                    : '--:--'
                            }
                        </strong>


                        <span
                            class="${status.className}"
                        >
                            ${status.text}
                        </span>

                    </div>


                    <div
                        style="
                            margin-top:8px;
                            display:grid;
                            gap:4px;
                        "
                    >

                        <div>
                            <b>Serviço:</b>
                            ${service?.name || '-'}
                        </div>


                        <div>
                            <b>Profissional:</b>
                            ${professional?.name || '-'}
                        </div>


                        <div>
                            <b>Duração:</b>
                            ${
                                Number(
                                    service?.duration
                                ) || 30
                            }
                            min
                        </div>


                        <div>
                            <b>Valor:</b>
                            ${money(
                                service?.price
                            )}
                        </div>

                    </div>

                </div>

            `;

        }).join('')

        : `

            <p class="muted">
                Este cliente ainda não possui agendamentos.
            </p>

        `;


    modal.innerHTML = `

        <div
            style="
                background:#fff;
                color:#222;
                width:100%;
                max-width:650px;
                max-height:90vh;
                overflow:auto;
                border-radius:14px;
                padding:24px;
                box-sizing:border-box;
                box-shadow:0 20px 60px rgba(0,0,0,.30);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:20px;
                    gap:10px;
                "
            >

                <div>

                    <h2
                        style="
                            margin:0;
                        "
                    >
                        Agendamentos
                    </h2>


                    <small>
                        ${client.name || 'Cliente'}
                    </small>

                </div>


                <button
                    type="button"
                    id="closeClientBookingsModal"
                >
                    ✕
                </button>

            </div>


            <div>

                ${rows}

            </div>

        </div>

    `;


    document.body.appendChild(modal);


    $('#closeClientBookingsModal')
        .onclick = () => {

            modal.remove();

        };
}

/* =========================================================
   AGENDAMENTOS DO CLIENTE
   ========================================================= */

async function visualizarAgendamentosCliente(
    clientId
) {

    if (!isAdmin()) {

        toast(
            'Acesso restrito ao administrador.'
        );

        return;
    }


    const client =
        (
            window.allClients ||
            []
        ).find(
            item =>
                item.id === clientId
        );


    if (!client) {

        toast(
            'Cliente não encontrado.'
        );

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
            professional_id
        `)
        .eq(
            'user_id',
            clientId
        )
        .order(
            'booking_date',
            {
                ascending:false
            }
        )
        .order(
            'booking_time',
            {
                ascending:false
            }
        );


    if (error) {

        console.error(
            'Erro ao carregar agendamentos:',
            error
        );

        toast(
            'Não foi possível carregar os agendamentos.'
        );

        return;
    }


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


    let professionalMap =
        new Map();


    if (serviceIds.length) {

        const {
            data = []
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
                data.map(
                    item => [
                        item.id,
                        item
                    ]
                )
            );
    }


    if (professionalIds.length) {

        const {
            data = []
        } = await sb
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
                data.map(
                    item => [
                        item.id,
                        item
                    ]
                )
            );
    }


    let modal =
        $('#clientBookingsModal');


    if (!modal) {

        modal =
            document.createElement(
                'div'
            );

        modal.id =
            'clientBookingsModal';

        modal.style.cssText = `
            position:fixed;
            inset:0;
            z-index:9999;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
            background:
                rgba(0,0,0,.65);
        `;

        document.body.appendChild(
            modal
        );
    }


    const statusText =
        status => {

            switch (status) {

                case 'completed':
                    return 'Concluído';

                case 'cancelled':
                    return 'Cancelado';

                case 'in_progress':
                    return 'Em atendimento';

                default:
                    return 'Confirmado';
            }
        };


    modal.innerHTML = `

        <div
            style="
                width:min(
                    760px,
                    100%
                );
                max-height:
                    calc(100vh - 40px);
                overflow:auto;
                padding:22px;
                border-radius:16px;
                background:
                    var(--card,#1a1a1a);
                box-shadow:
                    0 15px 50px
                    rgba(0,0,0,.35);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:
                        space-between;
                    align-items:center;
                    gap:10px;
                    margin-bottom:20px;
                "
            >

                <div>

                    <h2
                        style="
                            margin:0;
                        "
                    >
                        Agendamentos
                    </h2>

                    <p
                        class="muted"
                        style="
                            margin:5px 0 0;
                        "
                    >
                        ${
                            client.name ||
                            'Cliente'
                        }
                    </p>

                </div>


                <button
                    type="button"
                    id="closeClientBookings"
                    style="
                        font-size:20px;
                        padding:4px 9px;
                    "
                >
                    ×
                </button>

            </div>


            ${
                !bookings.length

                    ? `

                        <div
                            style="
                                padding:30px;
                                text-align:center;
                                border:
                                    1px dashed
                                    rgba(
                                        128,
                                        128,
                                        128,
                                        .3
                                    );
                                border-radius:14px;
                            "
                        >

                            <div
                                style="
                                    font-size:36px;
                                "
                            >
                                📅
                            </div>

                            <strong>
                                Nenhum agendamento
                            </strong>

                            <p class="muted">
                                Este cliente ainda não possui
                                agendamentos.
                            </p>

                        </div>

                    `

                    : `

                        <div
                            style="
                                display:grid;
                                gap:10px;
                            "
                        >

                            ${bookings.map(
                                booking => {

                                    const service =
                                        serviceMap.get(
                                            booking.service_id
                                        );


                                    const professional =
                                        professionalMap.get(
                                            booking.professional_id
                                        );


                                    const date =
                                        booking.booking_date
                                            ? new Date(
                                                booking.booking_date +
                                                'T12:00'
                                            ).toLocaleDateString(
                                                'pt-BR'
                                            )
                                            : '-';


                                    const time =
                                        booking.booking_time
                                            ?.slice(
                                                0,
                                                5
                                            ) ||
                                        '-';


                                    return `

                                        <div
                                            style="
                                                padding:14px;
                                                border:
                                                    1px solid
                                                    rgba(
                                                        128,
                                                        128,
                                                        128,
                                                        .20
                                                    );
                                                border-radius:12px;
                                            "
                                        >

                                            <div
                                                style="
                                                    display:flex;
                                                    justify-content:
                                                        space-between;
                                                    gap:10px;
                                                    flex-wrap:wrap;
                                                "
                                            >

                                                <strong>
                                                    ${date}
                                                    às
                                                    ${time}
                                                </strong>

                                                <span>
                                                    ${statusText(
                                                        booking.status
                                                    )}
                                                </span>

                                            </div>


                                            <div
                                                style="
                                                    margin-top:7px;
                                                "
                                            >
                                                ✂️
                                                ${
                                                    service?.name ||
                                                    'Serviço'
                                                }
                                            </div>


                                            <div
                                                class="muted"
                                                style="
                                                    margin-top:4px;
                                                "
                                            >
                                                Barbeiro:
                                                ${
                                                    professional?.name ||
                                                    'Não informado'
                                                }
                                                ${
                                                    service?.duration
                                                        ? ` · ${service.duration} min`
                                                        : ''
                                                }
                                                ${
                                                    service
                                                        ? ` · ${money(service.price)}`
                                                        : ''
                                                }
                                            </div>

                                        </div>

                                    `;

                                }
                            ).join('')}

                        </div>

                    `
            }

        </div>

    `;


    modal.style.display =
        'flex';


    $('#closeClientBookings')
        ?.addEventListener(
            'click',
            () => {
                modal.remove();
            }
        );
}
/* =========================================================
   ESTOQUE
   ========================================================= */
async function loadStock() {
    if (!isAdmin()) {
        return;
    }
    const {
        data = [],
        error
    } = await sb
        .from('inventory')
        .select('*')
        .order(
            'name'
        );
    if (error) {
        console.error(
            'Erro ao carregar estoque:',
            error
        );
        return;
    }
    if (!$('#stockList')) {
        return;
    }
    $('#stockList').innerHTML =
        data.length
            ? data.map(x => `
                <div class="list-row">
                    <div>
                        <b>
                            ${x.name}
                        </b>
                        <small>
                            Atual:
                            ${x.quantity}
                            • mínimo:
                            ${x.min_quantity}
                        </small>
                    </div>
                    <span
                        class="${Number(x.quantity) <=
                    Number(x.min_quantity)
                    ? 'cancel'
                    : 'ok'
                }"
                    >
                        ${Number(x.quantity) <=
                    Number(x.min_quantity)
                    ? 'Baixo'
                    : 'OK'
                }
                    </span>
                </div>
            `).join('')
            : `
                <p class="muted">
                    Nenhum produto.
                </p>
            `;
}
/* =========================================================
   FINANCEIRO
   ========================================================= */
async function loadFinance() {
    if (!isAdmin()) {
        return;
    }
    const month =
        today().slice(0, 7);
    const {
        data = [],
        error
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
        )
        .order(
            'entry_date',
            {
                ascending:
                    false
            }
        );
    if (error) {
        console.error(
            'Erro ao carregar financeiro:',
            error
        );
        return;
    }
    const income =
        data
            .filter(
                x =>
                    x.type ===
                    'income'
            )
            .reduce(
                (total, x) =>
                    total +
                    Number(
                        x.amount ||
                        0
                    ),
                0
            );
    const expense =
        data
            .filter(
                x =>
                    x.type ===
                    'expense'
            )
            .reduce(
                (total, x) =>
                    total +
                    Number(
                        x.amount ||
                        0
                    ),
                0
            );
    if ($('#sumIncome')) {
        $('#sumIncome').textContent =
            money(income);
    }
    if ($('#sumExpense')) {
        $('#sumExpense').textContent =
            money(expense);
    }
    if ($('#sumBalance')) {
        $('#sumBalance').textContent =
            money(
                income -
                expense
            );
    }
    if ($('#financeList')) {
        $('#financeList').innerHTML =
            data
                .slice(0, 12)
                .map(x => `
                    <div class="list-row">
                        <div>
                            <b>
                                ${x.description}
                            </b>
                            <small>
                                ${new Date(
                    x.entry_date +
                    'T12:00'
                ).toLocaleDateString(
                    'pt-BR'
                )
                    }
                            </small>
                        </div>
                        <span
                            class="${x.type ===
                        'income'
                        ? 'ok'
                        : 'cancel'
                    }"
                        >
                            ${x.type ===
                        'income'
                        ? '+'
                        : '-'
                    }
                            ${money(x.amount)}
                        </span>
                    </div>
                `)
                .join('')
            ||
            `
                <p class="muted">
                    Nenhum lançamento no mês.
                </p>
            `;
    }
}
/* =========================================================
   EQUIPE
   ========================================================= */
async function loadTeam() {
    if (!isAdmin()) {
        return;
    }
    const {
        data = [],
        error
    } = await sb
        .from('professionals')
        .select('*')
        .order(
            'name'
        );
    if (error) {
        console.error(
            'Erro ao carregar equipe:',
            error
        );
        return;
    }
    if (!$('#teamList')) {
        return;
    }
    $('#teamList').innerHTML =
        data.length
            ? data.map(x => `
                <div class="list-row">
                    <div>
                        <b>
                            ${x.name}
                        </b>
                        <small>
                            ${x.phone || ''}
                        </small>
                    </div>
                    <span
                        class="${x.active
                    ? 'ok'
                    : 'cancel'
                }"
                    >
                        ${x.active
                    ? 'Ativo'
                    : 'Inativo'
                }
                    </span>
                </div>
            `).join('')
            : `
                <p class="muted">
                    Nenhum profissional.
                </p>
            `;
}
/* =========================================================
   NAVEGAÇÃO DOS BOTÕES
   ========================================================= */
$$('[data-page]').forEach(button => {
    button.onclick = () => {
        go(
            button.dataset.page
        );
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
} = await sb.auth
    .signInWithPassword({
        email: $('#loginEmail').value.trim(),
        password: $('#loginPassword').value
    });

if (error) {
    console.error("ERRO DE LOGIN:", error);
    alert("E-mail ou senha incorretos.");
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
            const {
                error
            } =
                await sb
                    .from('inventory')
                    .insert({
                        name:
                            $('#stockName')
                                .value
                                .trim(),
                        quantity:
                            Number(
                                $('#stockQty')
                                    .value
                            ),
                        min_quantity:
                            Number(
                                $('#stockMin')
                                    .value
                            )
                    });
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
                    'dnh-logo.png'
            };
            const {
                error
            } =
                await sb
                    .from('settings')
                    .update(
                        patch
                    )
                    .eq(
                        'id',
                        1
                    );
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
                toast(
                    'Configurações salvas.'
                );
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
   ANIVERSARIANTES DO MÊS
   ========================================================= */

async function mostrarAniversariantesMes() {

    if (!isAdmin()) {
        toast(
            'Acesso restrito ao administrador.'
        );
        return;
    }


    const month =
        today().slice(
            5,
            7
        );


    const monthName =
        new Date(
            2000,
            Number(month) - 1,
            1
        ).toLocaleDateString(
            'pt-BR',
            {
                month: 'long'
            }
        );


    let clients =
        window.allClients || [];


    /* Se ainda não carregou clientes,
       buscar no Supabase */

    if (!clients.length) {

        const {
            data = [],
            error
        } = await sb
            .from('profiles')
            .select(
                'id,name,phone,email,birth'
            )
            .eq(
                'role',
                'client'
            )
            .order(
                'name'
            );


        if (error) {

            console.error(
                'Erro ao buscar aniversariantes:',
                error
            );

            toast(
                'Não foi possível carregar os aniversariantes.'
            );

            return;
        }


        clients =
            data || [];

        window.allClients =
            clients;

    }


    /* =====================================================
       FILTRAR SOMENTE PELO MÊS
       ===================================================== */

    const birthdays =
        clients
            .filter(
                client =>
                    client.birth &&
                    client.birth.slice(
                        5,
                        7
                    ) === month
            )
            .sort(
                (a, b) =>
                    Number(
                        a.birth.slice(
                            8,
                            10
                        )
                    ) -
                    Number(
                        b.birth.slice(
                            8,
                            10
                        )
                    )
            );


    /* =====================================================
       MODAL
       ===================================================== */

    $('#birthdayModal')?.remove();


    const modal =
        document.createElement(
            'div'
        );


    modal.id =
        'birthdayModal';


                modal.style.cssText = `
                position:fixed;
                inset:0;
                z-index:99999;
                display:flex;
                align-items:flex-start;
                justify-content:center;
                padding:12px;
                background:rgba(0,0,0,.70);
                overflow-y:auto;
                overflow-x:hidden;
                box-sizing:border-box;
            `;


    modal.innerHTML = `

        <div
            style="
                width:min(100%,650px);
                max-height:90vh;
                overflow:auto;
                background:var(--card,#fff);
                color:inherit;
                border-radius:18px;
                padding:24px;
                box-shadow:0 20px 70px rgba(0,0,0,.35);
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

                <div>

                    <h2
                        style="
                            margin:0 0 5px;
                            text-transform:capitalize;
                        "
                    >
                        🎂 Aniversariantes de ${monthName}
                    </h2>

                    <p
                        class="muted"
                        style="margin:0;"
                    >
                        Todos os aniversariantes deste mês
                    </p>

                </div>

                <button
                    type="button"
                    id="closeBirthdayModal"
                >
                    ✕
                </button>

            </div>


            ${
                birthdays.length
                    ? `

                        <div
                            style="
                                display:grid;
                                gap:10px;
                            "
                        >

                            ${birthdays.map(
                                client => {

                                    const day =
                                        client.birth.slice(
                                            8,
                                            10
                                        );

                                    const isToday =
                                        client.birth.slice(
                                            5,
                                            10
                                        ) ===
                                        today().slice(
                                            5,
                                            10
                                        );

                                    return `

                                        <div
                                            style="
                                                display:flex;
                                                align-items:center;
                                                justify-content:space-between;
                                                gap:12px;
                                                flex-wrap:wrap;
                                                padding:14px;
                                                border-radius:12px;
                                                background:
                                                    rgba(128,128,128,.08);
                                            "
                                        >

                                            <div>

                                                <strong>
                                                    🎂
                                                    ${client.name || 'Cliente'}
                                                </strong>

                                                <div
                                                    class="muted"
                                                    style="margin-top:4px;"
                                                >
                                                    Aniversário:
                                                    ${day}/${month}

                                                    ${
                                                        isToday
                                                            ? ' • 🎉 Hoje!'
                                                            : ''
                                                    }

                                                </div>

                                                ${
                                                    client.phone
                                                        ? `
                                                            <div
                                                                style="
                                                                    margin-top:4px;
                                                                "
                                                            >
                                                                📱
                                                                ${client.phone}
                                                            </div>
                                                        `
                                                        : ''
                                                }

                                            </div>


                                            ${
                                                client.phone
                                                    ? `
                                                        <button
                                                            type="button"
                                                            data-wa="${digits(client.phone)}"
                                                            data-msg="${encodeURIComponent(
                                                                'Olá, ' +
                                                                (client.name || 'tudo bem') +
                                                                '! 🎂 A equipe da DNH Barbearia deseja um feliz aniversário! Temos uma condição especial para você neste mês. Entre em contato conosco!'
                                                            )}"
                                                        >
                                                            📱 WhatsApp
                                                        </button>
                                                    `
                                                    : ''
                                            }

                                        </div>

                                    `;

                                }
                            ).join('')}

                        </div>

                    `
                    : `

                        <div
                            style="
                                text-align:center;
                                padding:30px 10px;
                            "
                        >

                            <div
                                style="
                                    font-size:42px;
                                "
                            >
                                🎂
                            </div>

                            <p>
                                Nenhum cliente faz aniversário
                                neste mês.
                            </p>

                        </div>

                    `
            }


            <div
                style="
                    display:flex;
                    justify-content:flex-end;
                    margin-top:20px;
                "
            >

                <button
                    type="button"
                    id="closeBirthdayModalBottom"
                >
                    Fechar
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    const close =
        () => {
            modal.remove();
        };


    $('#closeBirthdayModal')
        ?.addEventListener(
            'click',
            close
        );


    $('#closeBirthdayModalBottom')
        ?.addEventListener(
            'click',
            close
        );


    modal.addEventListener(
        'click',
        e => {

            if (
                e.target ===
                modal
            ) {
                close();
            }

        }
    );

}
if ($('#birthdayOnly')) {

    $('#birthdayOnly').onclick =
        async () => {

            await mostrarAniversariantesMes();

        };

}
/* =========================================================
   EVENTOS GERAIS
   ========================================================= */
document.addEventListener(
    'click',
    async e => {
                /* =================================================
           NOVO AGENDAMENTO ADMIN
           ================================================= */

        const adminNewBooking =
            e.target.closest(
                '[data-admin-new-booking]'
            );

        if (adminNewBooking) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }

            await novoAgendamentoAdmin();

            return;
        }
        /* =================================================
           EDITAR CLIENTE
           ================================================= */

        const editClient =
            e.target.closest(
                '[data-client-edit]'
            );

        if (editClient) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const clientId =
                editClient
                    .getAttribute(
                        'data-client-edit'
                    )
                    ?.trim();


            console.log(
                'EDITAR CLIENTE:',
                clientId
            );


            if (!clientId) {

                toast(
                    'ID do cliente não encontrado.'
                );

                return;
            }


            await editarCliente(
                clientId
            );

            return;
        }


        /* =================================================
           AGENDAMENTOS DO CLIENTE
           ================================================= */

        const clientBookings =
            e.target.closest(
                '[data-client-bookings]'
            );

        if (clientBookings) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const clientId =
                clientBookings
                    .getAttribute(
                        'data-client-bookings'
                    )
                    ?.trim();


            console.log(
                'AGENDAMENTOS CLIENTE:',
                clientId
            );


            if (!clientId) {

                toast(
                    'ID do cliente não encontrado.'
                );

                return;
            }


            await visualizarAgendamentosCliente(
                clientId
            );

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
        /* -------------------------
   HORÁRIO DO CLIENTE
   ------------------------- */

const timeButton =
    e.target.closest(
        '[data-booking-time]'
    );


if (timeButton) {

    if (!isClient()) {

        toast(
            'Acesso não permitido.'
        );

        return;
    }


    /* -------------------------
       RESETAR HORÁRIOS
       ------------------------- */

    $$('.time-option')
        .forEach(
            button => {

                button.classList.remove(
                    'selected'
                );

                button.style.background =
                    '#f5f5f5';

                button.style.color =
                    '#222';

                button.style.border =
                    '1px solid #999';

                button.style.fontWeight =
                    '500';

                button.style.boxShadow =
                    'none';

                button.textContent =
                    button.dataset.bookingTime;

            }
        );


    /* -------------------------
       SELECIONAR
       ------------------------- */

    timeButton.classList.add(
        'selected'
    );


    timeButton.style.background =
        '#198754';

    timeButton.style.color =
        '#fff';

    timeButton.style.border =
        '2px solid #146c43';

    timeButton.style.fontWeight =
        '700';

    timeButton.style.boxShadow =
        '0 0 0 3px rgba(25,135,84,.20)';


    timeButton.textContent =
        '✓ ' +
        timeButton.dataset.bookingTime;


    /* -------------------------
       ATUALIZAR RESUMO
       ------------------------- */

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
            const {
                error
            } =
                await sb
                    .from('bookings')
                    .update({
                        status:
                            newStatus
                    })
                    .eq(
                        'id',
                        bookingId
                    );
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

            const button =
                $('#confirmBooking');


            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    'Agendando...';

            }


            try {

                await createBooking();

            } finally {

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        'Confirmar Agendamento';

                }

            }

        };

}
if ($('#refreshClientBookings')) {
    $('#refreshClientBookings').onclick =
        consultarAgenda;
}
/* =========================================================
   EVENTOS DO CLIENTE
   ========================================================= */

if ($('#clientService')) {
    $('#clientService').onchange =
        async () => {

            if (!isClient()) {
                return;
            }

            atualizarResumoAgendamento('');

            await loadClientTimes();
        };
}

if ($('#clientProfessional')) {
    $('#clientProfessional').onchange =
        async () => {

            if (!isClient()) {
                return;
            }

            atualizarResumoAgendamento('');

            await loadClientTimes();
        };
}

if ($('#clientDate')) {
    $('#clientDate').onchange =
        async () => {

            if (!isClient()) {
                return;
            }

            atualizarResumoAgendamento('');

            await loadClientTimes();
        };
}


/* =========================================================
   CONFIRMAR AGENDAMENTO DO CLIENTE
   ========================================================= */

if ($('#confirmBooking')) {

    $('#confirmBooking').onclick =
        async () => {

            console.log(
                'CONFIRMAR AGENDAMENTO - CLIENTE'
            );

            await createBooking();
        };
}


/* =========================================================
   CONSULTAR AGENDAMENTOS
   ========================================================= */

if ($('#refreshClientBookings')) {

    $('#refreshClientBookings').onclick =
        async () => {

            await consultarAgenda();
        };
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
}

boot();
