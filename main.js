
/* ADMIN PAYROLL SYSTEM - HTML + CSS + JS + Supabase */

const SB_URL = 'https://eohsvouxreyvwvuwbldi.supabase.co';
const SB_KEY = 'sb_publishable_da3qVatvbvKWOUfaZtHkAA_d2NvnboP';

const NO_LOGIN = true; // TESTING LANG. Gawing false para ibalik ang login

if (typeof supabase === 'undefined') {
    const e = document.getElementById('loaderr');
    e.style.display = 'block';
    e.textContent = 'Hindi na-load ang Supabase library. Kailangan ng internet. I-check ang koneksyon at i-refresh (F5).';
    throw new Error('supabase-js not loaded');
}

const sb = supabase.createClient(SB_URL, SB_KEY);

const $ = (s, r = document) => r.querySelector(s);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

const money = n => Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const num = v => Number(v || 0);

async function q(p) {
    const { data, error } = await p;
    if (error) {
        alert('Error: ' + error.message);
        throw error;
    }
    return data;
}

/* ---------- LOOKUPS ---------- */

const empName = e => e
    ? `${e.last_name}, ${e.first_name}${e.middle_name ? ' ' + e.middle_name[0] + '.' : ''}`
    : '';

const empOpts = async () =>
    (await q(sb.from('employees')
        .select('id,last_name,first_name,middle_name')
        .order('last_name')))
        .map(e => [e.id, empName(e)]);

const periodOpts = async () =>
    (await q(sb.from('payroll_periods')
        .select('id,pay_date')
        .order('pay_date', { ascending: false })))
        .map(p => [p.id, p.pay_date]);

const tblOpts = t => async () =>
    (await q(sb.from(t).select('id,name').order('name')))
        .map(r => [r.id, r.name]);

/* ---------- MODAL + FORM HELPERS ---------- */

function modal(title, body, { wide = false, buttons = null } = {}) {
    const ov = document.createElement('div');
    ov.className = 'ov';

    ov.innerHTML = `
        <div class="modal ${wide ? 'wide' : ''}">
            <h3>${title}</h3>
            <div class="mb">${body}</div>
            <div class="mf"></div>
        </div>
    `;

    const close = () => ov.remove();
    const mf = $('.mf', ov);

    (buttons || [{
        text: 'Close',
        fn: (o, c) => c()
    }]).forEach(b => {
        const x = document.createElement('button');
        x.className = 'btn ' + (b.cls || '');
        x.innerHTML = b.text;
        x.onclick = () => b.fn(ov, close);
        mf.appendChild(x);
    });

    document.body.appendChild(ov);
    return { ov, close };
}

async function resolveOpts(fields) {
    for (const f of fields) {
        if (typeof f.opts === 'function') {
            f._o = await f.opts();
        } else if (f.opts) {
            f._o = f.opts;
        }
    }
}

function fieldHtml(f, v = '') {
    const id = 'f_' + f.k;

    if (f.opts) {
        return `
            <div>
                <label>${f.label}</label>
                <select id="${id}">
                    ${f.noph ? '' : `<option value="">${f.ph || 'Select'}</option>`}
                    ${(f._o || []).map(([val, lab]) => `
                        <option value="${esc(val)}"
                            ${String(v) === String(val) ? 'selected' : ''}>
                            ${esc(lab)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    return `
        <div>
            <label>${f.label}</label>
            <input id="${id}"
                type="${f.type || 'text'}"
                ${f.type === 'number' ? 'step="any"' : ''}
                value="${esc(v)}">
        </div>
    `;
}

function readFields(fields, root) {
    const o = {};

    for (const f of fields) {
        let v = $('#f_' + f.k, root).value;

        if (v === '') {
            v = null;
        } else if (f.type === 'number' || f.num) {
            v = Number(v);
        }

        o[f.k] = v;
    }

    return o;
}

async function sha(s) {
    if (!(window.crypto && crypto.subtle)) {
        throw new Error('Walang crypto support');
    }

    const b = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(s)
    );

    return [...new Uint8Array(b)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

/* ---------- GENERIC CRUD PANEL ---------- */

async function crud(el, cfg) {
    const links = (cfg.topLinks || [])
        .map(([l, h]) => `<a class="btn" href="#${h}">⊞ ${l}</a>`)
        .join('');

    el.innerHTML = `
        <div class="panel">
            <h2>${cfg.title}</h2>

            <div class="tb">
                ${links}
                <a class="addlink" href="javascript:void(0)">
                    <span class="box1 add">⊞</span>
                    <span class="add">${cfg.addLabel}</span>
                </a>
            </div>

            <div class="dt">
                <div class="dthead">
                    <label>
                        Show
                        <select class="len">
                            <option>10</option>
                            <option>25</option>
                            <option>50</option>
                            <option>100</option>
                        </select>
                        entries
                    </label>

                    <label>
                        Search:
                        <input class="srch">
                    </label>
                </div>

                <div class="tw">
                    <table>
                        <thead>
                            <tr>
                                ${cfg.cols.map(c => `<th>${c[0]}</th>`).join('')}
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>

                <div class="dtfoot">
                    <span class="info"></span>
                    <span class="pg"></span>
                </div>
            </div>
        </div>
    `;

    const tb = $('tbody', el);
    let rows = [], page = 1;

    async function load() {
        let qy = sb.from(cfg.table).select(cfg.select || '*');

        rows = await q(qy.order(cfg.order || 'id', {
            ascending: cfg.asc ?? false
        }));

        render();
    }

    function render() {
        const t = $('.srch', el).value.toLowerCase();

        const f = rows.filter(r =>
            !t || cfg.cols.map(c => String(c[1](r)))
                .join(' ').toLowerCase().includes(t)
        );

        const len = Number($('.len', el).value);
        const pages = Math.max(1, Math.ceil(f.length / len));

        if (page > pages) page = pages;

        const start = (page - 1) * len;
        const slice = f.slice(start, start + len);

        tb.innerHTML = slice.length
            ? slice.map(r => `
                <tr>
                    ${cfg.cols.map(c => `<td>${c[1](r)}</td>`).join('')}
                    <td>
                        <button class="btn ib" data-ed="${r.id}" title="Edit">✎</button>
                        <button class="btn ib dl" data-dl="${r.id}" title="Delete">🗑</button>
                    </td>
                </tr>
            `).join('')
            : `
                <tr class="empty">
                    <td colspan="${cfg.cols.length + 1}">
                        No data available in table
                    </td>
                </tr>
            `;

        $('.info', el).textContent =
            `Showing ${f.length ? start + 1 : 0} to ${start + slice.length} of ${f.length} entries`;

        let pg = `
            <button data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
                Previous
            </button>
        `;

        for (let i = 1; i <= pages; i++) {
            if (pages <= 7 || Math.abs(i - page) <= 2 || i === 1 || i === pages) {
                pg += `
                    <button data-p="${i}" class="${i === page ? 'cur' : ''}">
                        ${i}
                    </button>
                `;
            }
        }

        pg += `
            <button data-p="${page + 1}" ${page >= pages ? 'disabled' : ''}>
                Next
            </button>
        `;

        $('.pg', el).innerHTML = pg;

        $('.pg', el).querySelectorAll('button').forEach(b => {
            b.onclick = () => {
                page = Number(b.dataset.p);
                render();
            };
        });

        tb.querySelectorAll('[data-ed]').forEach(b => {
            b.onclick = () => form(
                rows.find(r => String(r.id) === b.dataset.ed)
            );
        });

        tb.querySelectorAll('[data-dl]').forEach(b => {
            b.onclick = async () => {
                if (!confirm('Delete this record?')) return;

                await q(sb.from(cfg.table)
                    .delete()
                    .eq('id', b.dataset.dl));

                load();
            };
        });
    }

    $('.srch', el).oninput = () => {
        page = 1;
        render();
    };

    $('.len', el).onchange = () => {
        page = 1;
        render();
    };

    async function form(row) {
        await resolveOpts(cfg.fields);

        const save = async (ov, close) => {
            const v = readFields(cfg.fields, ov);

            for (const f of cfg.fields) {
                if (f.req && (v[f.k] === null || v[f.k] === '')) {
                    return alert(f.label + ' is required');
                }
            }

            await q(row
                ? sb.from(cfg.table).update(v).eq('id', row.id)
                : sb.from(cfg.table).insert(v));

            close();
            load();
        };

        const buttons = cfg.plain
            ? [
                { text: 'SAVE', fn: save },
                { text: 'CANCEL', fn: (o, c) => c() }
            ]
            : [
                { text: row ? '⊞ Update' : '⊞ New', fn: save },
                { text: '⊘ Cancel', fn: (o, c) => c() },
                { text: '✖', cls: 'x', fn: (o, c) => c() }
            ];

        modal(
            cfg.modalTitle || cfg.title,
            `<div class="mform">
                ${cfg.fields.map(f =>
                    fieldHtml(f, row ? row[f.k] : (f.def ?? ''))
                ).join('')}
            </div>`,
            { buttons }
        );
    }

    el.querySelectorAll('.add').forEach(b => {
        b.onclick = () => form(null);
    });

    load();
}

/* ---------- EMPLOYEES ---------- */

const PERSONAL = [
    { k: 'emp_no', label: 'Employee Number', req: 1 },
    { k: 'last_name', label: 'Last Name', req: 1 },
    { k: 'first_name', label: 'First Name', req: 1 },
    { k: 'middle_name', label: 'Middle Name' },
    { k: 'gender', label: 'Gender', opts: [['Male', 'Male'], ['Female', 'Female']] },
    { k: 'email', label: 'Email Address', type: 'email' },
    { k: 'civil_status', label: 'Civil Status' },
    { k: 'nationality', label: 'Nationality' },
    { k: 'religion', label: 'Religion' },
    { k: 'birth_date', label: 'Birth Date', type: 'date' },
    { k: 'permanent_address', label: 'Permanent Address' },
    { k: 'present_address', label: 'Present Address' },
    { k: 'contact', label: 'Contact' },
    { k: 'sss_no', label: 'SSS NO' },
    { k: 'philhealth_no', label: 'Philhealth No' },
    { k: 'pagibig_no', label: 'Pag-ibig No' },
    { k: 'atm_no', label: 'ATM No' },
    { k: 'tin', label: 'TIN' }
];

const LAYOUT = [
    'photo', 'emp_no', 'portal', 'last_name', 'first_name',
    'middle_name', 'gender', 'email', 'civil_status', 'nationality',
    'religion', 'birth_date', 'permanent_address', 'present_address', null,
    'contact', 'sss_no', 'philhealth_no', 'pagibig_no', null,
    'atm_no', 'tin'
];

const CHILD_TABS = {
    emergency: {
        label: 'Emergency Contact',
        table: 'emergency_contacts',
        fields: [
            { k: 'name', label: 'Name' },
            { k: 'relationship', label: 'Relationship' },
            { k: 'address', label: 'Address' },
            { k: 'contact', label: 'Contact' }
        ]
    },

    dependent: {
        label: 'Dependent',
        table: 'dependents',
        fields: [
            { k: 'name', label: 'Name' },
            { k: 'birth_date', label: 'Birth Date', type: 'date' },
            { k: 'relationship', label: 'Relationship' }
        ]
    },

    education: {
        label: 'Educational Background',
        table: 'education',
        inline: 1,
        fields: [
            { k: 'school', label: 'School :' },
            { k: 'address', label: 'Address :' },
            { k: 'school_year', label: 'S.Y :' },
            {
                k: 'level',
                label: 'Level :',
                noph: 1,
                opts: ['Primary', 'Secondary', 'Tertiary', 'Graduate'].map(x => [x, x])
            }
        ]
    },

    reference: {
        label: 'Character Reference',
        table: 'char_references',
        fields: [
            { k: 'name', label: 'Name' },
            { k: 'occupation', label: 'Occupation' },
            { k: 'address', label: 'Address' },
            { k: 'contact', label: 'Contact' }
        ]
    },

    position: {
        label: 'Employee Position',
        table: 'employee_positions',
        fields: [
            { k: 'department_id', label: 'Department', opts: tblOpts('departments'), ph: 'Select Department', num: 1 },
            { k: 'position_id', label: 'Position', opts: tblOpts('positions'), ph: 'Select Position', num: 1 },
            { k: 'start_date', label: 'Start', type: 'date' },
            { k: 'end_date', label: 'End', type: 'date' },
            { k: 'monthly', label: 'Monthly', type: 'number' },
            { k: 'daily', label: 'Daily', type: 'number' },
            { k: 'hourly', label: 'Hourly', type: 'number' }
        ],
        select: '*,departments(name),positions(name)',
        show: r => [
            r.departments?.name,
            r.positions?.name,
            r.start_date,
            r.end_date,
            money(r.monthly),
            money(r.daily),
            money(r.hourly)
        ],
        heads: ['Department', 'Position', 'Start', 'End', 'Monthly', 'Daily', 'Hourly']
    }
};

async function employeesPage(el) {
    el.innerHTML = `
        <div class="panel">
            <h2>EMPLOYEE INFORMATION</h2>
            <div class="bar c">
                <button class="btn" id="eNew">⊞ New</button>
                <button class="btn" id="eCancel">⊘ Cancel</button>
                <button class="btn" id="ePrint">🖨 Print</button>
                <button class="btn" id="eView">👁 View</button>
            </div>
            <div id="eBody"></div>
        </div>
    `;

    const body = $('#eBody');
    let cur = null, tab = 'personal';

    async function nextNo() {
        const { count } = await sb.from('employees')
            .select('*', { count: 'exact', head: true });

        return `${String(new Date().getFullYear()).slice(2)}-${String((count || 0) + 1).padStart(3, '0')}`;
    }

    async function form() {
        const tabs = [
            ['personal', 'Personal Information'],
            ...Object.entries(CHILD_TABS).map(([k, v]) => [k, v.label])
        ];

        body.innerHTML = `
            <div class="tabs">
                ${tabs.map(([k, l]) => `
                    <button data-t="${k}" class="${k === tab ? 'on' : ''}">
                        ${l}
                    </button>
                `).join('')}
            </div>
            <div id="tabBody"></div>
        `;

        body.querySelectorAll('.tabs button').forEach(b => {
            b.onclick = () => {
                tab = b.dataset.t;
                form();
            };
        });

        if (tab === 'personal') {
            personal();
        } else {
            child(tab);
        }
    }

    async function personal() {
        await resolveOpts(PERSONAL);

        const v = cur || { emp_no: await nextNo() };

        const cell = k => {
            if (k === null) return '<div></div>';

            if (k === 'photo') {
                return `
                    <div class="photo">
                        ${v.photo_url ? `<img src="${esc(v.photo_url)}">` : ''}
                        <input type="file" id="f_photo" accept="image/*">
                    </div>
                `;
            }

            if (k === 'portal') {
                return `
                    <div>
                        <label>Portal Password</label>
                        <input id="f_portal" type="password"
                            autocomplete="new-password"
                            placeholder="${cur ? '(iwanang blangko = hindi babaguhin)' : ''}">
                    </div>
                `;
            }

            return fieldHtml(PERSONAL.find(f => f.k === k), v[k] ?? '');
        };

        $('#tabBody').innerHTML = `
            <div class="grid5">
                ${LAYOUT.map(cell).join('')}
            </div>
            <div class="bar" style="padding-left:14px">
                <button class="btn pri" id="eSave">
                    ${cur ? 'Update' : 'Save'}
                </button>
            </div>
        `;

        $('#eSave').onclick = async () => {
            const o = readFields(PERSONAL, body);

            if (!o.emp_no || !o.last_name || !o.first_name) {
                return alert('Employee number, last name and first name are required');
            }

            const pw = $('#f_portal').value;

            if (pw) {
                try {
                    o.portal_password_hash = await sha(o.emp_no + ':' + pw);
                } catch (e) {
                    alert('Hindi na-save ang portal password: ' + e.message);
                }
            }

            const file = $('#f_photo').files[0];

            if (file) {
                const path = `${o.emp_no}-${Date.now()}.${file.name.split('.').pop()}`;

                const { error } = await sb.storage
                    .from('employee-photos')
                    .upload(path, file, { upsert: true });

                if (error) {
                    alert('Photo upload failed: ' + error.message);
                } else {
                    o.photo_url = sb.storage
                        .from('employee-photos')
                        .getPublicUrl(path).data.publicUrl;
                }
            }

            cur = await q(cur
                ? sb.from('employees').update(o).eq('id', cur.id).select().single()
                : sb.from('employees').insert(o).select().single());

            alert('Saved');
            form();
        };
    }

    async function child(k) {
        const c = CHILD_TABS[k];
        await resolveOpts(c.fields);

        const heads = c.heads || c.fields.map(f => f.label.replace(/ ?:$/, ''));

        $('#tabBody').innerHTML = `
            <div class="crow ${c.inline ? 'inline' : ''}">
                ${c.fields.map(f =>
                    c.inline
                        ? fieldHtml(f).replace('<div>', '<div style="display:flex;align-items:center">')
                        : fieldHtml(f)
                ).join('')}

                <div>
                    <button class="btn gray" id="cAdd">Add</button>
                </div>
            </div>

            <div class="box tw">
                <table>
                    <thead>
                        <tr>
                            ${heads.map(h => `<th>${h}</th>`).join('')}
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="cBody"></tbody>
                </table>
            </div>
        `;

        async function load() {
            if (!cur) {
                $('#cBody').innerHTML = `
                    <tr class="empty">
                        <td colspan="${heads.length + 1}">
                            I-save muna ang Personal Information
                        </td>
                    </tr>
                `;
                return;
            }

            const rows = await q(sb.from(c.table)
                .select(c.select || '*')
                .eq('employee_id', cur.id)
                .order('id'));

            $('#cBody').innerHTML = rows.length
                ? rows.map(r => `
                    <tr>
                        ${(c.show ? c.show(r) : c.fields.map(f => r[f.k]))
                            .map(x => `<td>${esc(x)}</td>`).join('')}
                        <td>
                            <button class="btn ib dl" data-id="${r.id}">🗑</button>
                        </td>
                    </tr>
                `).join('')
                : `
                    <tr class="empty">
                        <td colspan="${heads.length + 1}">
                            No data available in table
                        </td>
                    </tr>
                `;

            $('#cBody').querySelectorAll('button[data-id]').forEach(b => {
                b.onclick = async () => {
                    if (confirm('Delete?')) {
                        await q(sb.from(c.table).delete().eq('id', b.dataset.id));
                        load();
                    }
                };
            });
        }

        $('#cAdd').onclick = async () => {
            if (!cur) {
                return alert('I-save muna ang Personal Information bago magdagdag.');
            }

            const o = readFields(c.fields, document);
            o.employee_id = cur.id;

            if (c.fields.every(f => o[f.k] === null || f.noph)) {
                return alert('Fill in the form first');
            }

            await q(sb.from(c.table).insert(o));

            c.fields.forEach(f => {
                if (!f.noph) $('#f_' + f.k).value = '';
            });

            load();
        };

        load();
    }

    async function viewList() {
        const rows = await q(sb.from('employees').select('*').order('last_name'));

        const m = modal('EMPLOYEES', `
            <div class="dt">
                <div class="dthead">
                    <span></span>
                    <label>Search: <input id="vs"></label>
                </div>

                <div class="tw">
                    <table>
                        <thead>
                            <tr>
                                <th>Emp No</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Contact</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(e => `
                                <tr data-id="${e.id}">
                                    <td>${esc(e.emp_no)}</td>
                                    <td class="l">${esc(empName(e))}</td>
                                    <td>${esc(e.email)}</td>
                                    <td>${esc(e.contact)}</td>
                                    <td>
                                        <button class="btn sm" data-o="1">Open</button>
                                        <button class="btn sm dl" data-d="1">🗑</button>
                                    </td>
                                </tr>
                            `).join('') || `
                                <tr class="empty">
                                    <td colspan="5">No data available in table</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `, { wide: true });

        $('#vs', m.ov).oninput = () => {
            const t = $('#vs', m.ov).value.toLowerCase();

            m.ov.querySelectorAll('tr[data-id]').forEach(tr => {
                tr.classList.toggle('hide',
                    !tr.textContent.toLowerCase().includes(t));
            });
        };

        m.ov.querySelectorAll('tr[data-id]').forEach(tr => {
            const e = rows.find(x => String(x.id) === tr.dataset.id);

            $('[data-o]', tr).onclick = () => {
                cur = e;
                tab = 'personal';
                m.close();
                form();
            };

            $('[data-d]', tr).onclick = async () => {
                if (confirm('Delete employee and all related records?')) {
                    await q(sb.from('employees').delete().eq('id', e.id));

                    if (cur && cur.id === e.id) cur = null;

                    m.close();
                    viewList();
                    form();
                }
            };
        });
    }

    async function printEmp() {
        if (!cur) return alert('Open or save an employee first');

        const all = await Promise.all(
            Object.values(CHILD_TABS).map(async c => [
                c,
                await q(sb.from(c.table)
                    .select(c.select || '*')
                    .eq('employee_id', cur.id))
            ])
        );

        let h = `
            <h2>Employee Information</h2>
            <table border="1" cellpadding="5"
                style="border-collapse:collapse;width:100%">
                ${PERSONAL.map(f => `
                    <tr>
                        <th align="left" width="30%">${f.label}</th>
                        <td>${esc(cur[f.k])}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        all.forEach(([c, rows]) => {
            h += `<h3>${c.label}</h3>` +
                (rows.length
                    ? `
                        <table border="1" cellpadding="4"
                            style="border-collapse:collapse;width:100%">
                            ${rows.map(r => `
                                <tr>
                                    ${(c.show ? c.show(r) : c.fields.map(f => r[f.k]))
                                        .map(x => `<td>${esc(x)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </table>
                    `
                    : '<i>None</i>');
        });

        printHtml(h);
    }

    $('#eNew').onclick = () => {
        cur = null;
        tab = 'personal';
        form();
    };

    $('#eCancel').onclick = () => {
        tab = 'personal';
        form();
    };

    $('#eView').onclick = viewList;
    $('#ePrint').onclick = printEmp;

    form();
}

/* ---------- PRINT ---------- */

function printHtml(h) {
    const w = window.open('', '_blank');

    w.document.write(`
        <html>
        <head>
            <title>Print</title>
            <style>
                body { font-family: Georgia, serif; padding: 20px; }
                th, td { font-size: 13px; }
            </style>
        </head>
        <body>${h}</body>
        </html>
    `);

    w.document.close();
    w.focus();

    setTimeout(() => w.print(), 300);
}

/* ---------- DEPARTMENT & POSITION ---------- */

function depPosPage(el) {
    el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div id="d"></div>
            <div id="p"></div>
        </div>
    `;

    crud($('#d'), {
        table: 'departments',
        title: 'DEPARTMENT',
        addLabel: 'Add Department',
        fields: [{ k: 'name', label: 'Department Name', req: 1 }],
        cols: [['Department Name', r => esc(r.name)]],
        order: 'id',
        asc: true
    });

    crud($('#p'), {
        table: 'positions',
        title: 'POSITION',
        addLabel: 'Add Position',
        fields: [{ k: 'name', label: 'Position Name', req: 1 }],
        cols: [['Position Name', r => esc(r.name)]],
        order: 'id',
        asc: true
    });
}

/* ---------- LOANS ---------- */

async function loanTypePage(el) {
    el.innerHTML = `
        <div class="panel">
            <h2>TYPE OF LOANS</h2>

            <div class="tb">
                <a class="btn" href="#loans">⊞ ADD EMPLOYEE LOANS</a>
            </div>

            <div class="two">
                <div class="lf">
                    <label>Loan Type:</label>
                    <input id="ltn">

                    <div>
                        <button class="btn" id="ltNew">New</button>
                        <button class="btn" id="ltCancel">Cancel</button>
                    </div>
                </div>

                <div class="tw">
                    <table>
                        <thead>
                            <tr>
                                <th>Loan Type</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="ltb"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    let editId = null;

    async function load() {
        const rows = await q(sb.from('loan_types')
            .select('*')
            .order('name'));

        $('#ltb').innerHTML = rows.length
            ? rows.map(r => `
                <tr>
                    <td>${esc(r.name)}</td>
                    <td>
                        <button class="btn ib" data-e="${r.id}">✎</button>
                        <button class="btn ib dl" data-d="${r.id}">🗑</button>
                    </td>
                </tr>
            `).join('')
            : '<tr class="empty"><td colspan="2">No data available in table</td></tr>';

        $('#ltb').querySelectorAll('[data-e]').forEach(b => {
            b.onclick = () => {
                const r = rows.find(x => String(x.id) === b.dataset.e);
                editId = r.id;
                $('#ltn').value = r.name;
                $('#ltNew').textContent = 'Update';
            };
        });

        $('#ltb').querySelectorAll('[data-d]').forEach(b => {
            b.onclick = async () => {
                if (confirm('Delete?')) {
                    await q(sb.from('loan_types').delete().eq('id', b.dataset.d));
                    load();
                }
            };
        });
    }

    const reset = () => {
        editId = null;
        $('#ltn').value = '';
        $('#ltNew').textContent = 'New';
    };

    $('#ltCancel').onclick = reset;

    $('#ltNew').onclick = async () => {
        const name = $('#ltn').value.trim();

        if (!name) return alert('Loan Type is required');

        await q(editId
            ? sb.from('loan_types').update({ name }).eq('id', editId)
            : sb.from('loan_types').insert({ name }));

        reset();
        load();
    };

    load();
}

async function loanPage(el) {
    const pays = await q(sb.from('loan_payments').select('loan_id,amount'));

    const paid = {};
    pays.forEach(p => {
        paid[p.loan_id] = (paid[p.loan_id] || 0) + num(p.amount);
    });

    crud(el, {
        table: 'loans',
        title: 'EMPLOYEE LOANS',
        modalTitle: 'EMPLOYEE LOANS',
        addLabel: 'Add New Loan',
        topLinks: [['ADD TYPE OF LOANS', 'loantypes']],
        select: '*,employees(last_name,first_name,middle_name),loan_types(name)',

        fields: [
            { k: 'employee_id', label: 'Employee:', opts: empOpts, num: 1, req: 1 },
            { k: 'loan_date', label: 'Loan Date:', type: 'date', req: 1 },
            { k: 'loan_type_id', label: 'Loan Type:', opts: tblOpts('loan_types'), num: 1, req: 1 },
            { k: 'amount', label: 'Loan Amount:', type: 'number', req: 1 },
            { k: 'deduction', label: 'Deduction per Payroll:', type: 'number', req: 1 }
        ],

        cols: [
            ['Employee', r => esc(empName(r.employees))],
            ['Date', r => r.loan_date],
            ['Type', r => esc(r.loan_types?.name)],
            ['Amount', r => money(r.amount)],
            ['Per Payroll', r => money(r.deduction)],
            ['Balance', r => money(num(r.amount) - (paid[r.id] || 0))]
        ]
    });
}

/* ---------- PAYROLL ---------- */

function periodPage(el) {
    crud(el, {
        table: 'payroll_periods',
        title: "EMPLOYEES' PAYROLL",
        modalTitle: 'PAYROLL PERIOD',
        addLabel: 'Add New Payroll',
        topLinks: [['ADD ATTENDANCE', 'attendance']],
        order: 'pay_date',

        fields: [
            { k: 'start_date', label: 'Date Start:', type: 'date', req: 1 },
            { k: 'end_date', label: 'Date End:', type: 'date', req: 1 },
            { k: 'pay_date', label: 'Pay Date:', type: 'date', req: 1 }
        ],

        cols: [
            ['Start Date', r => r.start_date],
            ['End Date', r => r.end_date],
            ['Pay Date', r => r.pay_date],
            ['Status', r => esc(r.status)]
        ]
    });
}

function attendancePage(el) {
    crud(el, {
        table: 'attendance',
        title: 'EMPLOYEE ATTENDANCE',
        modalTitle: 'EMPLOYEE ATTENDANCE',
        plain: 1,
        addLabel: 'Add New Attendance',
        topLinks: [['ADD PAYROLL', 'periods']],
        select: '*,employees(last_name,first_name,middle_name),payroll_periods(pay_date)',

        fields: [
            { k: 'payroll_id', label: 'Pay Date', opts: periodOpts, ph: '', num: 1, req: 1 },
            { k: 'employee_id', label: 'Employee Name', opts: empOpts, ph: '', num: 1, req: 1 },
            { k: 'daily', label: 'Daily', type: 'number', def: 0 },
            { k: 'absences', label: 'Absences', type: 'number', def: 0 },
            { k: 'tardiness', label: 'Tardiness', type: 'number', def: 0 },
            { k: 'undertime', label: 'Under Time', type: 'number', def: 0 },
            { k: 'overtime', label: 'Over Time', type: 'number', def: 0 }
        ],

        cols: [
            ['Employee Name', r => esc(empName(r.employees))],
            ['Pay Date', r => r.payroll_periods?.pay_date],
            ['Daily', r => r.daily],
            ['Absences', r => r.absences],
            ['Tardiness', r => r.tardiness],
            ['Under Time', r => r.undertime],
            ['Over Time', r => r.overtime]
        ]
    });
}

function incDecPage(el) {
    el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div id="i"></div>
            <div id="d"></div>
        </div>
    `;

    const common = () => [
        { k: 'payroll_id', label: 'Payroll:', opts: periodOpts, ph: '', num: 1, req: 1 },
        { k: 'employee_id', label: 'Employee:', opts: empOpts, ph: '', num: 1, req: 1 }
    ];

    const sel = '*,employees(last_name,first_name,middle_name),payroll_periods(pay_date)';

    crud($('#i'), {
        table: 'other_income',
        title: 'OTHER INCOME',
        modalTitle: 'OTHER INCOME',
        addLabel: 'Add Other Income',
        select: sel,

        fields: [
            ...common(),
            { k: 'income_type', label: 'Income Type:', req: 1 },
            { k: 'amount', label: 'Income Amount:', type: 'number', req: 1 }
        ],

        cols: [
            ['Emp', r => esc(empName(r.employees))],
            ['Pay Date', r => r.payroll_periods?.pay_date],
            ['Income', r => esc(r.income_type)],
            ['Amount', r => money(r.amount)]
        ]
    });

    crud($('#d'), {
        table: 'other_deductions',
        title: 'OTHER DEDUCTION',
        modalTitle: 'OTHER DEDUCTION',
        addLabel: 'Add Other Deduction',
        select: sel,

        fields: [
            ...common(),
            { k: 'deduction_type', label: 'Deduction Type:', req: 1 },
            { k: 'amount', label: 'Deduction Amount:', type: 'number', req: 1 }
        ],

        cols: [
            ['Emp', r => esc(empName(r.employees))],
            ['Pay Date', r => r.payroll_periods?.pay_date],
            ['Deduction', r => esc(r.deduction_type)],
            ['Amount', r => money(r.amount)]
        ]
    });
}

/* ---------- PROCESS PAYROLL ---------- */

async function computePayroll(pid) {
    const [att, inc, ded, pos, loans, pays] = await Promise.all([
        q(sb.from('attendance').select('*,employees(*)').eq('payroll_id', pid)),
        q(sb.from('other_income').select('*').eq('payroll_id', pid)),
        q(sb.from('other_deductions').select('*').eq('payroll_id', pid)),
        q(sb.from('employee_positions').select('*').order('start_date', { ascending: false })),
        q(sb.from('loans').select('*')),
        q(sb.from('loan_payments').select('*').neq('payroll_id', pid))
    ]);

    const paid = {};

    pays.forEach(p => {
        paid[p.loan_id] = (paid[p.loan_id] || 0) + num(p.amount);
    });

    const byEmp = {};

    att.forEach(a => {
        const e = byEmp[a.employee_id] ||= {
            emp: a.employees,
            days: 0,
            abs: 0,
            late: 0,
            ut: 0,
            ot: 0
        };

        e.days += num(a.daily);
        e.abs += num(a.absences);
        e.late += num(a.tardiness);
        e.ut += num(a.undertime);
        e.ot += num(a.overtime);
    });

    const rows = [], loanPays = [];

    for (const [eid, a] of Object.entries(byEmp)) {
        const p = pos.find(x => String(x.employee_id) === eid && !x.end_date)
            || pos.find(x => String(x.employee_id) === eid)
            || {};

        const daily = num(p.daily) || num(p.monthly) / 26;
        const hourly = num(p.hourly) || daily / 8;

        const basic = daily * a.days;
        const otPay = a.ot * hourly * 1.25;

        const oi = inc.filter(x => String(x.employee_id) === eid)
            .reduce((s, x) => s + num(x.amount), 0);

        const od = ded.filter(x => String(x.employee_id) === eid)
            .reduce((s, x) => s + num(x.amount), 0);

        let loanD = 0;

        loans.filter(l => String(l.employee_id) === eid).forEach(l => {
            const bal = num(l.amount) - (paid[l.id] || 0);
            const d = Math.min(num(l.deduction), Math.max(bal, 0));

            if (d > 0) {
                loanD += d;
                loanPays.push({
                    loan_id: l.id,
                    payroll_id: pid,
                    amount: d
                });
            }
        });

        const gross = basic + otPay + oi;
        const lateUt = (a.late + a.ut) / 60 * hourly;
        const totalD = lateUt + loanD + od;

        rows.push({
            employee_id: Number(eid),
            emp: a.emp,
            payroll_id: pid,
            daily_rate: daily,
            days: a.days,
            basic,
            overtime_pay: otPay,
            other_income: oi,
            gross,
            late_ut: lateUt,
            loan_deduction: loanD,
            other_deduction: od,
            total_deduction: totalD,
            net: gross - totalD
        });
    }

    return { rows, loanPays };
}

const fmtRow = r => `
    <tr>
        <td class="l">${esc(empName(r.emp || r.employees))}</td>
        <td>${money(r.daily_rate)}</td>
        <td>${r.days}</td>
        <td class="r">${money(r.basic)}</td>
        <td class="r">${money(r.overtime_pay)}</td>
        <td class="r">${money(r.other_income)}</td>
        <td class="r">${money(r.gross)}</td>
        <td class="r">${money(r.late_ut)}</td>
        <td class="r">${money(r.loan_deduction)}</td>
        <td class="r">${money(r.other_deduction)}</td>
        <td class="r"><b>${money(r.net)}</b></td>
    </tr>
`;

const regHead = `
    <thead>
        <tr>
            <th>Employee</th>
            <th>Daily</th>
            <th>Days</th>
            <th>Basic</th>
            <th>OT Pay</th>
            <th>Other Inc</th>
            <th>Gross</th>
            <th>Late/UT</th>
            <th>Loan</th>
            <th>Other Ded</th>
            <th>Net Pay</th>
        </tr>
    </thead>
`;

const regTotal = rows => `
    <tr class="tot">
        <td class="l">TOTAL</td>
        <td></td>
        <td></td>
        ${[
            'basic', 'overtime_pay', 'other_income', 'gross',
            'late_ut', 'loan_deduction', 'other_deduction', 'net'
        ].map(k => `
            <td class="r">
                ${money(rows.reduce((s, r) => s + num(r[k]), 0))}
            </td>
        `).join('')}
    </tr>
`;

async function processPage(el) {
    const periods = await q(sb.from('payroll_periods')
        .select('*')
        .order('pay_date', { ascending: false }));

    el.innerHTML = `
        <div class="panel">
            <h2>PROCESS PAYROLL</h2>

            <div class="bar c">
                <select id="pp">
                    <option value="">Select payroll period</option>
                    ${periods.map(p => `
                        <option value="${p.id}">
                            ${p.start_date} → ${p.end_date}
                            (pay ${p.pay_date}) [${p.status}]
                        </option>
                    `).join('')}
                </select>

                <button class="btn" id="pc">Compute (preview)</button>
                <button class="btn pri" id="ps">Generate &amp; Save</button>
            </div>

            <div class="hint">
                Kinukuha sa Attendance, Other Income/Deduction,
                Loans at rates sa Employee Position.
                Ang Generate &amp; Save ay pwedeng ulitin.
            </div>

            <div class="tw" id="pr"></div>
        </div>
    `;

    let last = null;

    async function run() {
        const pid = Number($('#pp').value);

        if (!pid) {
            alert('Pumili ng payroll period');
            return null;
        }

        last = {
            pid,
            ...(await computePayroll(pid))
        };

        $('#pr').innerHTML = last.rows.length
            ? `
                <table>
                    ${regHead}
                    <tbody>
                        ${last.rows.map(fmtRow).join('')}
                        ${regTotal(last.rows)}
                    </tbody>
                </table>
            `
            : '<p>Walang attendance para sa period na ito.</p>';

        return last;
    }

    $('#pc').onclick = run;

    $('#ps').onclick = async () => {
        const r = await run();

        if (!r || !r.rows.length) return;

        if (!confirm('I-save ang payroll para sa period na ito?')) return;

        await q(sb.from('loan_payments').delete().eq('payroll_id', r.pid));
        await q(sb.from('payroll_records').delete().eq('payroll_id', r.pid));

        await q(sb.from('payroll_records')
            .insert(r.rows.map(({ emp, ...x }) => x)));

        if (r.loanPays.length) {
            await q(sb.from('loan_payments').insert(r.loanPays));
        }

        await q(sb.from('payroll_periods')
            .update({ status: 'processed' })
            .eq('id', r.pid));

        alert('Payroll saved. Makikita na sa Reports.');
    };
}

/* ---------- REPORTS ---------- */

async function reportPage(el, mode) {
    const periods = await q(sb.from('payroll_periods')
        .select('*')
        .eq('status', 'processed')
        .order('pay_date', { ascending: false }));

    el.innerHTML = `
        <div class="panel">
            <h2>${mode === 'slip' ? 'PAYSLIPS' : 'PAYROLL SUMMARY'}</h2>

            <div class="bar c">
                <select id="rp">
                    <option value="">Select processed payroll</option>
                    ${periods.map(p => `
                        <option value="${p.id}">
                            ${p.start_date} → ${p.end_date}
                            (pay ${p.pay_date})
                        </option>
                    `).join('')}
                </select>

                <button class="btn" id="rprint">🖨 Print</button>
            </div>

            <div class="tw" id="rb"></div>
        </div>
    `;

    let rows = [], per = null;

    $('#rp').onchange = async () => {
        const pid = Number($('#rp').value);

        if (!pid) {
            $('#rb').innerHTML = '';
            return;
        }

        per = periods.find(p => p.id === pid);

        rows = await q(sb.from('payroll_records')
            .select('*,employees(*)')
            .eq('payroll_id', pid));

        rows.sort((a, b) =>
            empName(a.employees).localeCompare(empName(b.employees))
        );

        if (mode === 'slip') {
            $('#rb').innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Gross</th>
                            <th>Deductions</th>
                            <th>Net</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows.map((r, i) => `
                            <tr>
                                <td class="l">${esc(empName(r.employees))}</td>
                                <td class="r">${money(r.gross)}</td>
                                <td class="r">${money(r.total_deduction)}</td>
                                <td class="r"><b>${money(r.net)}</b></td>
                                <td>
                                    <button class="btn sm" data-i="${i}">
                                        Payslip
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            $('#rb').querySelectorAll('button[data-i]').forEach(b => {
                b.onclick = () => showSlip(rows[b.dataset.i]);
            });
        } else {
            $('#rb').innerHTML = `
                <table>
                    ${regHead}
                    <tbody>
                        ${rows.map(fmtRow).join('')}
                        ${regTotal(rows)}
                    </tbody>
                </table>
            `;
        }
    };

    const slipHtml = r => `
        <div style="border:1px solid #888;padding:14px;margin-bottom:14px;page-break-inside:avoid">
            <h3 style="margin:0">PAYSLIP</h3>

            <div>
                Period: ${per.start_date} to ${per.end_date}
                &nbsp; Pay date: ${per.pay_date}
            </div>

            <div>
                <b>${esc(empName(r.employees))}</b>
                (${esc(r.employees.emp_no)})
            </div>

            <table style="width:100%;margin-top:8px">
                <tr>
                    <td>Daily rate</td>
                    <td align="right">${money(r.daily_rate)}</td>
                    <td>Days worked</td>
                    <td align="right">${r.days}</td>
                </tr>

                <tr>
                    <td>Basic pay</td>
                    <td align="right">${money(r.basic)}</td>
                    <td>Late / Undertime</td>
                    <td align="right">${money(r.late_ut)}</td>
                </tr>

                <tr>
                    <td>Overtime pay</td>
                    <td align="right">${money(r.overtime_pay)}</td>
                    <td>Loan deduction</td>
                    <td align="right">${money(r.loan_deduction)}</td>
                </tr>

                <tr>
                    <td>Other income</td>
                    <td align="right">${money(r.other_income)}</td>
                    <td>Other deduction</td>
                    <td align="right">${money(r.other_deduction)}</td>
                </tr>

                <tr>
                    <td><b>Gross</b></td>
                    <td align="right"><b>${money(r.gross)}</b></td>
                    <td><b>Total deductions</b></td>
                    <td align="right"><b>${money(r.total_deduction)}</b></td>
                </tr>
            </table>

            <h3 style="text-align:right;margin:8px 0 0">
                NET PAY: ${money(r.net)}
            </h3>
        </div>
    `;

    function showSlip(r) {
        modal('Payslip', `
            <div style="padding:14px 20px">
                ${slipHtml(r)}
            </div>
        `, {
            buttons: [
                {
                    text: '🖨 Print',
                    cls: 'pri',
                    fn: () => printHtml(slipHtml(r))
                },
                {
                    text: 'Close',
                    fn: (o, c) => c()
                }
            ]
        });
    }

    $('#rprint').onclick = () => {
        if (!rows.length) return alert('Pumili muna ng payroll');

        printHtml(mode === 'slip'
            ? rows.map(slipHtml).join('')
            : `
                <h2>Payroll Summary</h2>
                <div>
                    ${per.start_date} to ${per.end_date}
                    | Pay date ${per.pay_date}
                </div>
                <br>
                <table border="1" cellpadding="4"
                    style="border-collapse:collapse;width:100%">
                    ${regHead}
                    <tbody>
                        ${rows.map(fmtRow).join('')}
                        ${regTotal(rows)}
                    </tbody>
                </table>
            `
        );
    };
}

/* ---------- ROUTER / AUTH ---------- */

const MENU = [
    ['Employees', [
        ['Employee Information', 'employees'],
        ['Department & Position', 'deppos']
    ]],

    ['Loans', [
        ['Employee Loans', 'loans'],
        ['Type of Loans', 'loantypes']
    ]],

    ['Payroll', [
        ['Payroll Period', 'periods'],
        ['Attendance', 'attendance'],
        ['Other Income & Deduction', 'incdec'],
        ['Process Payroll', 'process']
    ]],

    ['Reports', [
        ['Payroll Summary', 'summary'],
        ['Payslips', 'slips']
    ]]
];

const ROUTES = {
    employees: employeesPage,
    deppos: depPosPage,
    loans: loanPage,
    loantypes: loanTypePage,
    periods: periodPage,
    attendance: attendancePage,
    incdec: incDecPage,
    process: processPage,
    summary: el => reportPage(el, 'sum'),
    slips: el => reportPage(el, 'slip')
};

const TITLES = {
    employees: 'EMPLOYEE',
    deppos: 'DEPARTMENT & POSITION',
    loans: 'LOANS',
    loantypes: 'TYPE OF LOANS',
    periods: 'PAYROLL',
    attendance: 'ATTENDANCE',
    incdec: 'OTHER INCOME & DEDUCTION',
    process: 'PROCESS PAYROLL',
    summary: 'PAYROLL SUMMARY',
    slips: 'PAYSLIPS'
};

function route() {
    const r = (location.hash || '#employees').slice(1);

    document.title = TITLES[r] || 'ADMIN PAYROLL SYSTEM';

    const v = $('#view');
    v.innerHTML = '';

    (ROUTES[r] || employeesPage)(v);
}

const ICON_USER = `
    <svg viewBox="0 0 24 24">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z"/>
    </svg>
`;

const ICON_OUT = `
    <svg viewBox="0 0 24 24">
        <path d="M10 3H4v18h6v-2H6V5h4V3zm5 4-1.4 1.4 2.6 2.6H9v2h7.2l-2.6 2.6L15 17l5-5-5-5z"/>
    </svg>
`;

/* ---------- NAVIGATION WITH LOGO ---------- */

function buildNav() {

    $('#nav').innerHTML = `
        <img
            id="logo"
            src="1.png"
            alt="Payroll Logo"
            onerror="this.style.display='none'"
        >

        <span class="brand">ADMIN PAYROLL SYSTEM</span>

        ${MENU.map(([t, items]) => `
            <div class="menu">
                <span>${t} ▾</span>

                <div class="dd">
                    ${items.map(([l, h]) => `
                        <a href="#${h}">${l}</a>
                    `).join('')}
                </div>
            </div>
        `).join('')}

        <span class="sp"></span>

        <button class="ic" title="User">
            ${ICON_USER}
        </button>

        <button class="ic" id="logout" title="Logout">
            ${ICON_OUT}
        </button>
    `;

    $('#logout').onclick = async () => {
        if (NO_LOGIN) return location.reload();

        await sb.auth.signOut();
        show(false);
    };
}

/* ---------- SHOW APPLICATION ---------- */

function show(on) {
    $('#login').classList.toggle('hide', on);
    $('#app').classList.toggle('hide', !on);

    if (on) {
        buildNav();
        route();
    }
}

/* ---------- LOGIN ---------- */

$('#lbtn').onclick = async () => {
    $('#lerr').textContent = '';

    const { error } = await sb.auth.signInWithPassword({
        email: $('#lemail').value.trim(),
        password: $('#lpass').value
    });

    if (error) {
        $('#lerr').textContent = error.message;
    } else {
        show(true);
    }
};

$('#lpass').onkeydown = e => {
    if (e.key === 'Enter') {
        $('#lbtn').click();
    }
};

window.addEventListener('hashchange', () => {
    if (!$('#app').classList.contains('hide')) {
        route();
    }
});

/* ---------- INITIALIZE ---------- */

if (NO_LOGIN) {
    show(true);
} else {
    sb.auth.getSession().then(({ data }) => {
        show(!!data.session);
    });
}
