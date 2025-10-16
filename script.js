// ======================
// STORAGE.JS
// ======================
const STORAGE_KEY = 'student_finance_records';
const SETTINGS_KEY = 'student_finance_settings';

function saveToStorage(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings() {
    const settings = localStorage.getItem(SETTINGS_KEY);
    return settings ? JSON.parse(settings) : {
        spendingCap: 0,
        baseCurrency: 'USD',
        exchangeRate: 1,
        categories: ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other']
    };
}

// ======================
// STATE.JS
// ======================
let records = loadFromStorage();
let settings = loadSettings();
let currentEditId = null;
let isCaseSensitive = false;

// Generate unique ID
function generateId() {
    return 'rec_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Create a new record
function createRecord(description, amount, category, date) {
    return {
        id: generateId(),
        description: description.trim(),
        amount: parseFloat(amount),
        category: category,
        date: date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// Update an existing record
function updateRecord(id, description, amount, category, date) {
    const index = records.findIndex(record => record.id === id);
    if (index !== -1) {
        records[index] = {
            ...records[index],
            description: description.trim(),
            amount: parseFloat(amount),
            category: category,
            date: date,
            updatedAt: new Date().toISOString()
        };
        return true;
    }
    return false;
}

// Delete a record
function deleteRecord(id) {
    const initialLength = records.length;
    records = records.filter(record => record.id !== id);
    return records.length !== initialLength;
}

// ======================
// VALIDATORS.JS
// ======================
const validators = {
    description: {
        regex: /^\S(?:.*\S)?$/,
        message: 'Description cannot have leading/trailing spaces'
    },
    amount: {
        regex: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
        message: 'Amount must be a valid number with up to 2 decimal places'
    },
    date: {
        regex: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        message: 'Date must be in YYYY-MM-DD format'
    },
    category: {
        regex: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
        message: 'Category can only contain letters, spaces, and hyphens'
    },
    duplicateWords: {
        regex: /\b(\w+)\s+\1\b/i,
        message: 'Description contains duplicate words'
    }
};

function validateField(field, value) {
    // Skip validation for empty fields (they'll be handled by required attribute)
    if (!value) return true;
    
    // Validate against specific rules
    if (validators[field]) {
        if (!validators[field].regex.test(value)) {
            return validators[field].message;
        }
    }
    
    // Special validation for duplicate words in description
    if (field === 'description' && validators.duplicateWords.regex.test(value)) {
        return validators.duplicateWords.message;
    }
    
    return true;
}

function validateForm() {
    const description = document.getElementById('description').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    
    const errors = {};
    
    errors.description = validateField('description', description);
    errors.amount = validateField('amount', amount);
    errors.category = validateField('category', category);
    errors.date = validateField('date', date);
    
    // Display errors
    Object.keys(errors).forEach(field => {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = errors[field] === true ? '' : errors[field];
        }
    });
    
    // Return true if all validations pass
    return Object.values(errors).every(result => result === true);
}

// ======================
// UI.JS
// ======================
function renderCategories() {
    const categorySelect = document.getElementById('category');
    const categoriesList = document.getElementById('categories-list');
    
    // Clear existing options
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    categoriesList.innerHTML = '';
    
    // Add categories to select
    settings.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
        
        // Add to categories list in settings
        const categoryItem = document.createElement('div');
        categoryItem.style.display = 'flex';
        categoryItem.style.justifyContent = 'space-between';
        categoryItem.style.alignItems = 'center';
        categoryItem.style.padding = '8px 0';
        
        const categoryText = document.createElement('span');
        categoryText.textContent = category;
        categoryItem.appendChild(categoryText);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.onclick = () => {
            if (settings.categories.length > 1) {
                settings.categories = settings.categories.filter(c => c !== category);
                saveSettings(settings);
                renderCategories();
                renderRecords();
                updateDashboard();
            }
        };
        categoryItem.appendChild(deleteBtn);
        
        categoriesList.appendChild(categoryItem);
    });
}

function renderRecords(searchTerm = '') {
    const recordsBody = document.getElementById('records-body');
    const recordsCards = document.getElementById('records-cards');
    const noRecords = document.getElementById('no-records');
    
    // Filter records based on search term
    let filteredRecords = records;
    if (searchTerm) {
        try {
            const flags = isCaseSensitive ? 'g' : 'gi';
            const regex = new RegExp(searchTerm, flags);
            filteredRecords = records.filter(record => 
                regex.test(record.description) || 
                regex.test(record.category) || 
                regex.test(record.amount.toString()) ||
                regex.test(record.date)
            );
        } catch (e) {
            // Invalid regex, show all records
            filteredRecords = records;
        }
    }
    
    // Render for desktop (table)
    recordsBody.innerHTML = '';
    if (filteredRecords.length === 0) {
        noRecords.style.display = 'block';
    } else {
        noRecords.style.display = 'none';
        filteredRecords.forEach(record => {
            const row = document.createElement('tr');
            row.className = 'fade-in';
            
            // Highlight matches in description
            let descriptionHTML = record.description;
            if (searchTerm) {
                try {
                    const flags = isCaseSensitive ? 'g' : 'gi';
                    const regex = new RegExp(`(${searchTerm})`, flags);
                    descriptionHTML = record.description.replace(regex, '<mark>$1</mark>');
                } catch (e) {
                    // If regex fails, just show the description
                }
            }
            
            row.innerHTML = `
                <td>${descriptionHTML}</td>
                <td><span class="record-category">${record.category}</span></td>
                <td>$${record.amount.toFixed(2)}</td>
                <td>${record.date}</td>
                <td>
                    <button class="btn action-btn" onclick="editRecord('${record.id}')">Edit</button>
                    <button class="btn action-btn btn-danger" onclick="confirmDelete('${record.id}')">Delete</button>
                </td>
            `;
            recordsBody.appendChild(row);
        });
    }
    
    // Render for mobile (cards)
    recordsCards.innerHTML = '';
    filteredRecords.forEach(record => {
        const card = document.createElement('div');
        card.className = 'record-card fade-in';
        
        // Highlight matches in description
        let descriptionHTML = record.description;
        if (searchTerm) {
            try {
                const flags = isCaseSensitive ? 'g' : 'gi';
                const regex = new RegExp(`(${searchTerm})`, flags);
                descriptionHTML = record.description.replace(regex, '<mark>$1</mark>');
            } catch (e) {
                // If regex fails, just show the description
            }
        }
        
        card.innerHTML = `
            <div class="record-header">
                <div class="record-amount">$${record.amount.toFixed(2)}</div>
                <div class="record-date">${record.date}</div>
            </div>
            <div class="record-description">${descriptionHTML}</div>
            <div class="record-category">${record.category}</div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn" onclick="editRecord('${record.id}')">Edit</button>
                <button class="btn btn-danger" onclick="confirmDelete('${record.id}')">Delete</button>
            </div>
        `;
        recordsCards.appendChild(card);
    });
}

function updateDashboard() {
    // Total records
    document.getElementById('total-records').textContent = records.length;
    
    // Total spent
    const totalSpent = records.reduce((sum, record) => sum + record.amount, 0);
    document.getElementById('total-spent').textContent = `$${totalSpent.toFixed(2)}`;
    
    // Top category
    if (records.length > 0) {
        const categoryCounts = {};
        records.forEach(record => {
            categoryCounts[record.category] = (categoryCounts[record.category] || 0) + record.amount;
        });
        
        const topCategory = Object.keys(categoryCounts).reduce((a, b) => 
            categoryCounts[a] > categoryCounts[b] ? a : b
        );
        document.getElementById('top-category').textContent = topCategory;
    } else {
        document.getElementById('top-category').textContent = '-';
    }
    
    // Spending cap status
    const capStatus = document.getElementById('cap-status');
    const spendingCap = settings.spendingCap;
    document.getElementById('spending-cap').textContent = `$${spendingCap.toFixed(2)}`;
    
    if (spendingCap > 0) {
        const remaining = spendingCap - totalSpent;
        if (remaining >= 0) {
            capStatus.textContent = `Remaining: $${remaining.toFixed(2)}`;
            capStatus.className = 'alert-success';
            capStatus.setAttribute('aria-live', 'polite');
        } else {
            capStatus.textContent = `Over budget by: $${Math.abs(remaining).toFixed(2)}`;
            capStatus.className = 'alert-danger';
            capStatus.setAttribute('aria-live', 'assertive');
        }
    } else {
        capStatus.textContent = 'No cap set';
        capStatus.className = 'alert-warning';
        capStatus.setAttribute('aria-live', 'polite');
    }
    
    // Last 7 days trend
    renderTrendChart();
}

function renderTrendChart() {
    const trendContainer = document.getElementById('trend-container');
    
    if (records.length === 0) {
        trendContainer.innerHTML = '<p>No data available</p>';
        return;
    }
    
    // Get last 7 days
    const today = new Date();
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    // Calculate daily totals
    const dailyTotals = {};
    dates.forEach(date => {
        dailyTotals[date] = 0;
    });
    
    records.forEach(record => {
        if (dates.includes(record.date)) {
            dailyTotals[record.date] += record.amount;
        }
    });
    
    // Find max value for scaling
    const maxAmount = Math.max(...Object.values(dailyTotals));
    
    // Create chart
    const chart = document.createElement('div');
    chart.style.display = 'flex';
    chart.style.gap = '8px';
    chart.style.alignItems = 'flex-end';
    chart.style.height = '100px';
    chart.style.marginTop = '16px';
    
    dates.forEach(date => {
        const day = new Date(date);
        const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
        
        const barContainer = document.createElement('div');
        barContainer.style.display = 'flex';
        barContainer.style.flexDirection = 'column';
        barContainer.style.alignItems = 'center';
        barContainer.style.flex = '1';
        
        const bar = document.createElement('div');
        bar.className = 'trend-bar';
        const fill = document.createElement('div');
        fill.className = 'trend-fill';
        
        if (maxAmount > 0) {
            const percentage = (dailyTotals[date] / maxAmount) * 100;
            fill.style.width = `${percentage}%`;
        }
        
        bar.appendChild(fill);
        barContainer.appendChild(bar);
        barContainer.appendChild(document.createTextNode(dayName));
        barContainer.appendChild(document.createElement('br'));
        barContainer.appendChild(document.createTextNode(`$${dailyTotals[date].toFixed(0)}`));
        
        chart.appendChild(barContainer);
    });
    
    trendContainer.innerHTML = '';
    trendContainer.appendChild(chart);
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show requested section
    document.getElementById(sectionId).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
    
    // Scroll to top
    window.scrollTo(0, 0);
}

function resetForm() {
    document.getElementById('record-form').reset();
    document.getElementById('record-id').value = '';
    currentEditId = null;
    document.getElementById('form-title').textContent = 'Add New Record';
    
    // Clear errors
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
}

// ======================
// SEARCH.JS
// ======================
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const caseToggle = document.getElementById('case-toggle');
    
    searchInput.addEventListener('input', () => {
        renderRecords(searchInput.value);
    });
    
    caseToggle.addEventListener('click', () => {
        isCaseSensitive = !isCaseSensitive;
        caseToggle.textContent = isCaseSensitive ? 'Case Sensitive' : 'Case Insensitive';
        renderRecords(searchInput.value);
    });
}

// ======================
// MAIN.JS
// ======================
// Initialize the app
function init() {
    // Load settings and render categories
    renderCategories();
    
    // Set up settings inputs
    document.getElementById('spending-cap-input').value = settings.spendingCap;
    document.getElementById('base-currency').value = settings.baseCurrency;
    document.getElementById('exchange-rate').value = settings.exchangeRate;
    
    // Set up form submission
    document.getElementById('record-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (validateForm()) {
            const description = document.getElementById('description').value;
            const amount = document.getElementById('amount').value;
            const category = document.getElementById('category').value;
            const date = document.getElementById('date').value;
            
            if (currentEditId) {
                if (updateRecord(currentEditId, description, amount, category, date)) {
                    saveToStorage(records);
                    renderRecords();
                    updateDashboard();
                    resetForm();
                    showSection('records');
                }
            } else {
                const newRecord = createRecord(description, amount, category, date);
                records.push(newRecord);
                saveToStorage(records);
                renderRecords();
                updateDashboard();
                resetForm();
                showSection('records');
            }
        }
    });
    
    // Set up cancel button
    document.getElementById('cancel-edit').addEventListener('click', () => {
        resetForm();
        showSection('records');
    });
    
    // Set up settings save
    document.getElementById('spending-cap-input').addEventListener('change', (e) => {
        settings.spendingCap = parseFloat(e.target.value) || 0;
        saveSettings(settings);
        updateDashboard();
    });
    
    document.getElementById('base-currency').addEventListener('change', (e) => {
        settings.baseCurrency = e.target.value;
        saveSettings(settings);
    });
    
    document.getElementById('exchange-rate').addEventListener('change', (e) => {
        settings.exchangeRate = parseFloat(e.target.value) || 1;
        saveSettings(settings);
    });
    
    // Add new category
    document.getElementById('add-category').addEventListener('click', () => {
        const newCategoryInput = document.getElementById('new-category');
        const newCategory = newCategoryInput.value.trim();
        
        if (newCategory && !settings.categories.includes(newCategory)) {
            // Validate category format
            if (validators.category.regex.test(newCategory)) {
                settings.categories.push(newCategory);
                saveSettings(settings);
                renderCategories();
                newCategoryInput.value = '';
            } else {
                alert('Category name is invalid. Only letters, spaces, and hyphens are allowed.');
            }
        }
    });
    
    // Import/Export
    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = JSON.stringify(records, null, 2);
        const dataUri = 'application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'student-finance-records.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });
    
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedRecords = JSON.parse(event.target.result);
                
                // Basic validation - check if it's an array of objects with required fields
                if (Array.isArray(importedRecords) && 
                    importedRecords.every(record => 
                        record.id && 
                        record.description && 
                        typeof record.amount === 'number' && 
                        record.category && 
                        record.date
                    )) {
                    
                    records = importedRecords;
                    saveToStorage(records);
                    renderRecords();
                    updateDashboard();
                    document.getElementById('import-message').textContent = 'Data imported successfully!';
                    document.getElementById('import-message').className = 'alert-success';
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                document.getElementById('import-message').textContent = 'Error importing data. Please check the file format.';
                document.getElementById('import-message').className = 'alert-danger';
            }
        };
        reader.readAsText(file);
    });
    
    // Set up navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            showSection(sectionId);
        });
    });
    
    // Set up sorting
    document.getElementById('sort-date').addEventListener('click', () => {
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveToStorage(records);
        renderRecords();
    });
    
    document.getElementById('sort-desc').addEventListener('click', () => {
        records.sort((a, b) => a.description.localeCompare(b.description));
        saveToStorage(records);
        renderRecords();
    });
    
    document.getElementById('sort-amount').addEventListener('click', () => {
        records.sort((a, b) => b.amount - a.amount);
        saveToStorage(records);
        renderRecords();
    });
    
    // Initialize UI
    renderRecords();
    updateDashboard();
    setupSearch();
}

// Edit record function
function editRecord(id) {
    const record = records.find(r => r.id === id);
    if (record) {
        currentEditId = id;
        document.getElementById('record-id').value = id;
        document.getElementById('description').value = record.description;
        document.getElementById('amount').value = record.amount;
        document.getElementById('category').value = record.category;
        document.getElementById('date').value = record.date;
        document.getElementById('form-title').textContent = 'Edit Record';
        showSection('add-record');
    }
}

// Confirm delete function
function confirmDelete(id) {
    if (confirm('Are you sure you want to delete this record?')) {
        if (deleteRecord(id)) {
            saveToStorage(records);
            renderRecords();
            updateDashboard();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
