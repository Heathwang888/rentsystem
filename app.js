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
  card.dataset.status = customer.status;
  card.dataset.id = customer._id;

  // 計算到期日和狀態
  const contractDate = new Date(customer.contractDate);
  const today = new Date();
  
  // 計算累計繳款和未付金額
  const totalPaid = customer.paymentRecords?.reduce((sum, record) => sum + record.amount, 0) || 0;
  const unpaidAmount = customer.rent - (totalPaid % customer.rent);
  
  // 計算當前期數的到期日（基於合約起始日）
  const currentPeriod = Math.floor(totalPaid / customer.rent);
  const dueDate = new Date(contractDate);
  dueDate.setDate(dueDate.getDate() + (7 * (currentPeriod + 1)));
  
  let statusTag = '';
  let paymentStatus = '';
  let nextPaymentDate = '';
  
  if (customer.status === 'renting') {
    // 計算逾期天數
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    
    // 如果有任何繳款記錄，視為已續約
    if (customer.paymentRecords && customer.paymentRecords.length > 0) {
      if (unpaidAmount > 0) {
        paymentStatus = `當期尚餘 $${unpaidAmount} 未繳納`;
      }
      nextPaymentDate = `下次繳款日：${formatDate(dueDate)}`;
    } else {
      // 完全沒有繳款的情況
      if (daysOverdue === 0) {
        statusTag = '本日應繳款';
      } else if (daysOverdue > 0) {
        statusTag = `逾期 ${daysOverdue} 日`;
      }
    }
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-top">
        <strong>${customer.name}</strong>
        ${customer.notes ? `<span class="note-tag">（${customer.notes}）</span>` : ''}
        <div class="right-section">
          ${paymentStatus ? `<span class="payment-status">${paymentStatus}</span>` : ''}
          ${nextPaymentDate ? `<span class="next-payment">${nextPaymentDate}</span>` : ''}
          <span class="status-tag ${customer.status}">${getStatusText(customer.status)}</span>
          ${statusTag ? `<span class="due-today">${statusTag}</span>` : ''}
        </div>
      </div>
      <div class="card-summary">
        <span>${customer.model}</span> ｜ 
        <span>價金：$${customer.salePrice}</span> ｜ 
        <span>租金：$${customer.rent}</span>
        ${customer.status === 'renting' ? 
          `<button class="pay-btn" onclick="showPaymentModal('${customer._id}', ${unpaidAmount}, ${customer.rent}, ${customer.salePrice})">繳款</button>` : 
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
      <p><strong>戶籍地址：</strong>${customer.address}</p>
      <p><strong>通訊地址：</strong>${customer.contactAddress || '同上'}</p>
      <p><strong>合約起始日：</strong>${formatDate(customer.contractDate)}</p>
      <p><strong>買賣價金：</strong>$${customer.salePrice}</p>
      <p><strong>租金：</strong>$${customer.rent} / 週</p>
      <p><strong>撥款帳戶：</strong>${customer.bank} / 戶名：${customer.bankAccountName} / 帳號：${customer.bankAccountNumber}</p>
      <p><strong>歷史繳款紀錄：</strong></p>
      <ul>
        ${customer.paymentRecords?.map(record => 
          `<li>${formatDate(record.date)} - $${record.amount}</li>`
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
        <button class="mark-locked" onclick="markAsLocked('${customer._id}')">呆帳(鎖機)</button>
      </div>
    </div>
  `;

  return card;
}

// 顯示繳款彈窗
function showPaymentModal(customerId, unpaidAmount, rent, salePrice) {
  const modal = document.getElementById('payment-modal');
  const amountInput = document.getElementById('payment-amount');
  const submitBtn = document.getElementById('submit-payment');
  
  amountInput.value = unpaidAmount; // 預設顯示未繳金額
  amountInput.min = unpaidAmount; // 設置最小繳款金額
  amountInput.max = salePrice; // 設置最大繳款金額為買回金額
  
  // 移除舊的事件監聽器
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
  
  // 添加新的事件監聽器
  newSubmitBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    if (amount < unpaidAmount) {
      alert('繳款金額不能小於未繳金額');
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
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW');
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

// 初始化頁面
document.addEventListener('DOMContentLoaded', () => {
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
        card.style.display = (filter === 'all' || card.dataset.status === filter) ? 'block' : 'none';
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
    addForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const formData = new FormData(this);

      try {
        const response = await fetch(`${API_BASE_URL}/api/customers`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('新增客戶失敗');
        }

        alert('✅ 新增成功');
        this.reset();
        showPage('list'); // 切換到列表頁
        loadCustomers(); // 重新載入客戶列表
      } catch (error) {
        console.error('新增客戶失敗:', error);
        alert('新增客戶失敗，請稍後再試');
      }
    });
  }
}); 
