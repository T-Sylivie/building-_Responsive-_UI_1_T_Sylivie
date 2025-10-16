// STATE & STORAGE

let records = JSON.parse(localStorage.getItem('financeRecords')) || [];
let settings = JSON.parse(localStorage.getItem('financeSettings')) || {
  spendingCap: 500,
  baseCurrency: 'USD',
  currency1: '',
  rate1: 1,
  currency2: '',
  rate2: 1,
  categories: ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other']
};

// VALIDATORS

const validators = {
  description: /^\S(?:.*\S)?$/,
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  noDuplicateWords: /\b(\w+)\s+\1\b/i
};

function validateField(value, type) {
  if (type === 'description') {
    if (!validators.description.test(value)) return 'Must not have leading/trailing spaces.';
    if (validators.noDuplicateWords.test(value)) return 'No duplicate words allowed.';
  }
  if (type === 'amount' && !validators.amount.test(value)) return 'Invalid amount (e.g., 12.50).';
  if (type === 'date' && !validators.date.test(value)) return 'Invalid date (YYYY-MM-DD).';
  if (type === 'category' && !validators.category.test(value)) return 'Letters, spaces, hyphens only.';
  return '';
}


// UI RENDERING

function renderCategories() {
  const select = document.getElementById('category');
  select.innerHTML = '';
  settings.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderRecords() {
  const tableBody = document.getElementById('records-table-body');
  const cardsContainer = document.getElementById('records-cards-container');
  tableBody.innerHTML = '';
  cardsContainer.innerHTML = '';

  const searchTerm = document.getElementById('search-input').value;
  const caseSensitive = document.getElementById('case-sensitive').checked;
  let filtered = [...records];

  if (searchTerm) {
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(escaped, flags);
      filtered = records.filter(r => 
        regex.test(r.description) ||
        regex.test(r.category) ||
        regex.test(r.amount.toString()) ||
        regex.test(r.date)
      ).map(r => ({
        ...r,
        description: r.description.replace(regex, match => `<mark>${match}</mark>`),
        category: r.category.replace(regex, match => `<mark>${match}</mark>`)
      }));
    } catch (e) {
      console.warn('Invalid search pattern');
    }
  }

  filtered.forEach(record => {
    // Table
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${record.date}</td>
      <td>${record.description}</td>
      <td>${record.category}</td>
      <td>${record.amount.toFixed(2)}</td>
      <td>
        <button class="btn-edit" data-id="${record.id}">Edit</button>
        <button class="btn-delete" data-id="${record.id}">Delete</button>
      </td>
    `;
    tableBody.appendChild(tr);

    // Cards (mobile)
    const card = document.createElement('div');
    card.className = 'record-card';
    card.innerHTML = `
      <strong>${record.date}</strong><br>
      <div>${record.description}</div>
      <div><em>${record.category}</em> — ${record.amount.toFixed(2)}</div>
      <div class="actions">
        <button class="btn-edit" data-id="${record.id}">Edit</button>
        <button class="btn-delete" data-id="${record.id}">Delete</button>
      </div>
    `;
    cardsContainer.appendChild(card);
  });

  // Rebind events
  document.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', e => editRecord(e.target.dataset.id))
  );
  document.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', e => deleteRecord(e.target.dataset.id))
  );
}

function renderStats() {
  const totalRecords = records.length;
  const totalSpent = records.reduce((sum, r) => sum + r.amount, 0);
  document.getElementById('total-records').textContent = totalRecords;
  document.getElementById('total-spent').textContent = totalSpent.toFixed(2);

  // Top category
  const catTotals = {};
  records.forEach(r => catTotals[r.category] = (catTotals[r.category] || 0) + r.amount);
  const topCat = Object.keys(catTotals).reduce((a, b) => catTotals[a] > catTotals[b] ? a : b, '');
  document.getElementById('top-category').textContent = topCat || '-';

  // Budget
  const cap = parseFloat(settings.spendingCap) || 0;
  const remaining = cap - totalSpent;
  const remainingEl = document.getElementById('remaining');
  const bar = document.getElementById('remaining-bar');
  const msg = document.getElementById('budget-message');

  if (cap > 0) {
    remainingEl.textContent = remaining.toFixed(2);
    const percent = Math.max(0, Math.min(100, (remaining / cap) * 100));
    bar.style.width = `${percent}%`;
    bar.style.backgroundColor = remaining < 0 ? 'var(--danger)' : 'var(--success)';

    if (remaining < 0) {
      msg.textContent = `⚠️ Over budget by ${Math.abs(remaining).toFixed(2)}!`;
      msg.setAttribute('aria-live', 'assertive');
      msg.style.color = 'var(--danger)';
    } else {
      msg.textContent = `✅ ${remaining.toFixed(2)} remaining this month.`;
      msg.setAttribute('aria-live', 'polite');
      msg.style.color = 'var(--success)';
    }
  } else {
    remainingEl.textContent = 'Set cap in Settings';
    bar.style.width = '0%';
    msg.textContent = '';
  }

  // 7-day trend
  const today = new Date();
  const last7Dates = Array.from({length: 7}, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyData = last7Dates.map(date => {
    const total = records
      .filter(r => r.date === date)
      .reduce((sum, r) => sum + r.amount, 0);
    return { date, total };
  });

  const maxTotal = Math.max(...dailyData.map(d => d.total), 1);
  const container = document.getElementById('trend-container');
  container.innerHTML = '';
  dailyData.forEach(d => {
    const bar = document.createElement('div');
    bar.title = `${d.date}: ${d.total.toFixed(2)}`;
    bar.style.flex = '1';
    bar.style.backgroundColor = d.total > 0 ? 'var(--primary)' : '#eee';
    bar.style.height = `${(d.total / maxTotal) * 100}%`;
    bar.style.alignSelf = 'flex-end';
    container.appendChild(bar);
  });
}

function loadSettingsUI() {
  document.getElementById('spending-cap').value = settings.spendingCap || '';
  document.getElementById('base-currency').value = settings.baseCurrency || 'USD';
  document.getElementById('currency1').value = settings.currency1 || '';
  document.getElementById('rate1').value = settings.rate1 || '';
  document.getElementById('currency2').value = settings.currency2 || '';
  document.getElementById('rate2').value = settings.rate2 || '';
  document.getElementById('custom-categories').value = settings.categories.join(', ');
}


// CRUD

function saveRecord(e) {
  e.preventDefault();
  const id = document.getElementById('record-id').value || 'rec_' + Date.now().toString(36);
  const desc = document.getElementById('description').value.trim();
  const amount = document.getElementById('amount').value.trim();
  const category = document.getElementById('category').value.trim();
  const date = document.getElementById('date').value.trim();

  // Validate
  const errors = {
    desc: validateField(desc, 'description'),
    amount: validateField(amount, 'amount'),
    date: validateField(date, 'date'),
    category: validateField(category, 'category')
  };

  document.getElementById('desc-error').textContent = errors.desc;
  document.getElementById('amount-error').textContent = errors.amount;
  document.getElementById('date-error').textContent = errors.date;
  document.getElementById('category-error').textContent = errors.category;

  if (Object.values(errors).some(e => e)) return;

  const record = {
    id,
    description: desc,
    amount: parseFloat(amount),
    category,
    date,
    createdAt: records.find(r => r.id === id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (document.getElementById('record-id').value) {
    const idx = records.findIndex(r => r.id === id);
    records[idx] = record;
  } else {
    records.push(record);
    // Optional: add fade-in to last card
    const cards = document.querySelectorAll('.record-card');
    if (cards.length) cards[cards.length - 1].classList.add('fade-in');
  }

  localStorage.setItem('financeRecords', JSON.stringify(records));
  renderRecords();
  renderStats();

  // Reset form
  document.getElementById('record-form').reset();
  document.getElementById('record-id').value = '';
  document.getElementById('form-title').textContent = 'Add New Record';
  document.getElementById('cancel-edit').style.display = 'none';
}

function editRecord(id) {
  const record = records.find(r => r.id === id);
  if (!record) return;

  document.getElementById('record-id').value = record.id;
  document.getElementById('description').value = record.description;
  document.getElementById('amount').value = record.amount;
  document.getElementById('category').value = record.category;
  document.getElementById('date').value = record.date;
  document.getElementById('form-title').textContent = 'Edit Record';
  document.getElementById('cancel-edit').style.display = 'inline-block';

  // Scroll to form
  document.getElementById('add-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteRecord(id) {
  if (!confirm('Delete this record?')) return;
  records = records.filter(r => r.id !== id);
  localStorage.setItem('financeRecords', JSON.stringify(records));
  renderRecords();
  renderStats();
}

function cancelEdit() {
  document.getElementById('record-form').reset();
  document.getElementById('record-id').value = '';
  document.getElementById('form-title').textContent = 'Add New Record';
  document.getElementById('cancel-edit').style.display = 'none';
}

// SETTINGS & IMPORT/EXPORT
function saveSettings() {
  const catsInput = document.getElementById('custom-categories').value;
  const cats = catsInput
    .split(',')
    .map(c => c.trim())
    .filter(c => c);

  settings = {
    spendingCap: parseFloat(document.getElementById('spending-cap').value) || 0,
    baseCurrency: document.getElementById('base-currency').value || 'USD',
    currency1: document.getElementById('currency1').value,
    rate1: parseFloat(document.getElementById('rate1').value) || 1,
    currency2: document.getElementById('currency2').value,
    rate2: parseFloat(document.getElementById('rate2').value) || 1,
    categories: cats.length ? cats : ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other']
  };

  localStorage.setItem('financeSettings', JSON.stringify(settings));
  renderCategories();
  renderStats();
}

function exportData() {
  const data = { records, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student-finance-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.records) && data.settings) {
        records = data.records;
        settings = data.settings;
        localStorage.setItem('financeRecords', JSON.stringify(records));
        localStorage.setItem('financeSettings', JSON.stringify(settings));
        renderCategories();
        renderRecords();
        renderStats();
        loadSettingsUI();
        alert('Data imported successfully!');
      } else {
        throw new Error('Invalid structure');
      }
    } catch (err) {
      alert('Import failed. Please use a valid export file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}


// SORTING

function sortRecords(by) {
  records.sort((a, b) => {
    if (by === 'date') return new Date(b.date) - new Date(a.date);
    if (by === 'desc') return a.description.localeCompare(b.description);
    if (by === 'amount') return b.amount - a.amount;
    return 0;
  });
  renderRecords();
}


// INIT

function init() {
  renderCategories();
  renderRecords();
  renderStats();
  loadSettingsUI();

  // Set today as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;

  // Events
  document.getElementById('record-form').addEventListener('submit', saveRecord);
  document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', importData);

  document.getElementById('search-input').addEventListener('input', renderRecords);
  document.getElementById('case-sensitive').addEventListener('change', renderRecords);

  document.getElementById('sort-date').addEventListener('click', () => sortRecords('date'));
  document.getElementById('sort-desc').addEventListener('click', () => sortRecords('desc'));
  document.getElementById('sort-amount').addEventListener('click', () => sortRecords('amount'));
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
