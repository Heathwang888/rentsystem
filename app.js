const API_BASE_URL = 'https://five-iridescent-flyaway.glitch.me';

// 切換頁面
function showPage(pageId) {
  // 更新 URL
  const newUrl = `${window.location.pathname}?page=${pageId}`;
  window.history.pushState({ page: pageId }, '', newUrl);
  
  // 切換頁面顯示
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  
  // 如果是客戶列表頁，載入客戶資料
  if (pageId === 'list') {
    loadCustomers();
  }
}

// 載入客戶列表
async function loadCustomers() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers`);
    const data = await response.json();
    
    const customerList = document.querySelector('.customer-list');
    customerList.innerHTML = ''; // 清空現有列表
    
    data.customers.forEach(customer => {
      const card = createCustomerCard(customer);
      customerList.appendChild(card);
    });
  } catch (error) {
    console.error('載入客戶列表失敗:', error);
    alert('載入客戶列表失敗，請稍後再試');
  }
}

// 創建客戶卡片
function createCustomerCard(customer) {
  const card = document.createElement('div');
  card.className = 'customer-card';
  card.dataset.customerId = customer._id;
  card.dataset.status = customer.status;

  // 格式化日期
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 計算下次繳款日期
  const nextDueDate = new Date(customer.nextDueDate);
  const today = new Date();
  const isDueToday = nextDueDate.toDateString() === today.toDateString();
  
  // 計算顯示狀態
  let statusText = '';
  if (customer.status === 'buyback') {
    statusText = '已買回';
  } else if (customer.status === 'locked') {
    statusText = '呆帳';
  } else {
    if (customer.daysOverdue > 0) {
      statusText = `逾期 ${customer.daysOverdue} 天`;
    } else if (isDueToday) {
      statusText = '本日應繳款';
    } else if (customer.daysRemaining > 0) {
      statusText = `下次繳款剩餘 ${customer.daysRemaining} 日`;
    }
  }

  // 計算顯示金額
  let amountText = '';
  if (customer.status === 'renting') {
    if (customer.totalUnpaid > 0) {
      amountText = `尚餘 ${customer.totalUnpaid.toLocaleString()} 未繳納`;
    } else if (customer.currentPeriodUnpaid > 0) {
      amountText = `尚餘 ${customer.currentPeriodUnpaid.toLocaleString()} 未繳納`;
    }
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-top">
        <strong>${customer.name}</strong>
        <div class="right-section">
          ${statusText ? `<span class="payment-status">${statusText}</span>` : ''}
          ${amountText ? `<span class="amount">${amountText}</span>` : ''}
          <span class="status-tag ${customer.status}">${getStatusText(customer.status)}</span>
        </div>
      </div>
      <div class="card-summary">
        <div class="info">
          <span>${customer.model}</span>
          <span>價金：${customer.salePrice.toLocaleString()}</span>
          <span>租金：${customer.rent.toLocaleString()}</span>
        </div>
        ${customer.status === 'renting' ? 
          `<button class="pay-btn" onclick="showPaymentModal('${customer._id}', ${customer.rent}, ${customer.salePrice})">繳款</button>` : 
          ''}
      </div>
      <button class="toggle-detail" onclick="toggleDetails(this)">▼ 展開</button>
    </div>
    <div class="card-detail" style="display:none;">
      <p><strong>手機號碼：</strong>${customer.phone}</p>
      <p><strong>身分證字號：</strong>${customer.idNumber}</p>
      <p><strong>手機型號：</strong>${customer.model}</p>
      <p><strong>IMEI：</strong>${customer.imei}</p>
      <p><strong>序號：</strong>${customer.serialNumber}</p>
      <p><strong>螢幕密碼：</strong>${customer.screenPassword || '未設定'}</p>
      <p><strong>戶籍地址：</strong>${customer.address}</p>
      <p><strong>通訊地址：</strong>${customer.contactAddress || '同上'}</p>
      <p><strong>合約起始日：</strong>${formatDate(customer.contractDate)}</p>
      <p><strong>買賣價金：</strong>${customer.salePrice.toLocaleString()}</p>
      <p><strong>租金：</strong>${customer.rent.toLocaleString()} / 週</p>
      <p><strong>撥款帳戶：</strong>${customer.bank} / 戶名：${customer.bankAccountName} / 帳號：${customer.bankAccountNumber}</p>
      <p><strong>歷史繳款紀錄：</strong></p>
      <ul>
        ${customer.paymentRecords?.map(record => 
          `<li>${formatDate(record.date)} - ${record.amount.toLocaleString()}</li>`
        ).join('') || ''}
      </ul>
      <p><strong>備註：</strong> 
        <input type="text" class="note-input" placeholder="輸入備註..." value="${customer.notes || ''}">
        <button class="save-note" onclick="saveNote('${customer._id}', this)">確認</button>
      </p>
      <div class="card-actions">
        <button class="download-contract" onclick="downloadFile('${customer._id}', 'contract')">下載合約</button>
        <button class="download-id" onclick="downloadFile('${customer._id}', 'id')">下載身分證</button>
        <button class="download-disbursement" onclick="downloadFile('${customer._id}', 'disbursement')">下載撥款水單</button>
        ${customer.status === 'renting' ? `
          <button class="mark-locked" onclick="markAsLocked('${customer._id}')">呆帳(鎖機)</button>
        ` : ''}
        <button class="delete-customer" onclick="deleteCustomer('${customer._id}')">刪除客戶</button>
      </div>
    </div>
  `;
  
  // 添加今日須繳款標記
  if (isDueToday) {
    card.dataset.dueToday = 'true';
  }
  
  return card;
}

// 顯示繳款彈窗
function showPaymentModal(customerId, rent, salePrice) {
  const modal = document.getElementById('payment-modal');
  const amountInput = document.getElementById('payment-amount');
  const submitBtn = document.getElementById('submit-payment');
  
  amountInput.value = ''; // 清空預設金額
  amountInput.min = 0; // 允許任意金額
  amountInput.max = salePrice; // 設置最大繳款金額為買回金額
  
  // 移除舊的事件監聽器
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
  
  // 添加新的事件監聽器
  newSubmitBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      alert('請輸入有效的繳款金額');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });
      
      if (!response.ok) {
        throw new Error('繳款失敗');
      }
      
      modal.style.display = 'none';
      alert('✅ 繳款成功');
      loadCustomers(); // 重新載入客戶列表
    } catch (error) {
      console.error('繳款失敗:', error);
      alert('繳款失敗，請稍後再試');
    }
  });
  
  modal.style.display = 'block';
}

// 保存備註
async function saveNote(customerId, button) {
  const input = button.previousElementSibling;
  const notes = input.value;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/notes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes })
    });
    
    if (!response.ok) {
      throw new Error('更新備註失敗');
    }
    
    alert('✅ 備註更新成功');
    loadCustomers(); // 重新載入客戶列表
  } catch (error) {
    console.error('更新備註失敗:', error);
    alert('更新備註失敗，請稍後再試');
  }
}

// 標記為呆帳
async function markAsLocked(customerId) {
  if (!confirm('確定要將此客戶標記為呆帳嗎？')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/lock`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('標記呆帳失敗');
    }
    
    alert('✅ 已標記為呆帳');
    loadCustomers(); // 重新載入客戶列表
  } catch (error) {
    console.error('標記呆帳失敗:', error);
    alert('標記呆帳失敗，請稍後再試');
  }
}

// 下載文件
async function downloadFile(customerId, type) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/files/${type}`);
    
    if (!response.ok) {
      throw new Error('下載文件失敗');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${customerId}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('下載文件失敗:', error);
    alert('下載文件失敗，請稍後再試');
  }
}

// 切換詳細資訊顯示
function toggleDetails(button) {
  const detail = button.closest('.customer-card').querySelector('.card-detail');
  detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
  button.textContent = detail.style.display === 'none' ? '▼ 展開' : '▲ 收起';
}

// 獲取狀態文字
function getStatusText(status) {
  const statusMap = {
    'renting': '租賃中',
    'buyback': '已買回',
    'locked': '呆帳'
  };
  return statusMap[status] || status;
}

// 刪除客戶
async function deleteCustomer(customerId) {
  if (!confirm('確定要刪除此客戶嗎？此操作無法復原。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('刪除失敗');
    }

    alert('✅ 客戶已刪除');
    loadCustomers(); // 重新載入客戶列表
  } catch (error) {
    console.error('刪除客戶失敗:', error);
    alert('刪除客戶失敗，請稍後再試');
  }
}

// 新增客戶
async function addCustomer(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  
  // 驗證必填欄位
  const requiredFields = ['name', 'idNumber', 'phone', 'address', 'model', 'imei', 'serialNumber', 'salePrice', 'rent', 'contractDate', 'bank', 'bankAccountName', 'bankAccountNumber'];
  for (const field of requiredFields) {
    if (!formData.get(field)) {
      alert(`請填寫${field}欄位`);
      return;
    }
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '新增客戶失敗');
    }
    
    const customer = await response.json();
    loadCustomers();
    event.target.reset();
    
    // 切換到列表頁
    showPage('list');
  } catch (error) {
    console.error('Error:', error);
    alert(error.message);
  }
}

// 在頁面載入時設置水單上傳的檔案類型
document.addEventListener('DOMContentLoaded', () => {
  const disbursementFileInput = document.querySelector('input[name="disbursementFile"]');
  if (disbursementFileInput) {
    disbursementFileInput.accept = 'image/jpeg,image/png';
  }

  // 從 URL 獲取當前頁面
  const urlParams = new URLSearchParams(window.location.search);
  const currentPage = urlParams.get('page') || 'dashboard';
  
  // 顯示當前頁面
  showPage(currentPage);
  
  // 側邊欄按鈕事件
  document.querySelectorAll('.sidebar button').forEach(button => {
    button.addEventListener('click', () => {
      const pageId = button.dataset.page;
      showPage(pageId);
    });
  });
  
  // 篩選按鈕事件
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.customer-card').forEach(card => {
        if (filter === 'due-today') {
          card.style.display = card.dataset.dueToday === 'true' ? 'block' : 'none';
        } else {
          card.style.display = (filter === 'all' || card.dataset.status === filter) ? 'block' : 'none';
        }
      });
    });
  });

  // 關閉繳款視窗
  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('payment-modal').style.display = 'none';
  });

  // 同戶籍地址勾選
  const sameBox = document.getElementById('sameAsRegistered');
  if (sameBox) {
    sameBox.addEventListener('change', () => {
      const reg = document.querySelector('[name="address"]');
      const cur = document.getElementById('currentAddress');
      if (sameBox.checked) cur.value = reg.value;
    });
  }

  // 新增客戶表單提交
  const addForm = document.getElementById('add-customer-form');
  if (addForm) {
    addForm.addEventListener('submit', addCustomer);
  }
}); 
