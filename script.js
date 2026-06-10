const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxZcwMvCxB-bd_FPeaT9B7kkms1o1ARjNrTYacg9yWGFOEs08dQlZAF-peAdDg6D_1N/exec";
const members = ["大仙", "冠宇", "書晴", "瑄瑄"];
let expensesData = [];
let currentDisplayLimit = 5; // 預設顯示 5 筆資料

document.addEventListener("DOMContentLoaded", function () {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("expense-date").value = today;
  const ym = today.substring(0, 7);
  document.getElementById("filter-start").value = `${ym}-01`;
  document.getElementById("filter-end").value = today;
  renderFormMembers();
  document
    .getElementById("total-amount")
    .addEventListener("input", calculateFormSplits);
  document
    .querySelectorAll('input[name="split-type"]')
    .forEach((r) => r.addEventListener("change", handleFormTypeChange));
  handleFormTypeChange();
  fetchHistoryData();
});

function fetchHistoryData() {
  document.getElementById("expenses-list-container").innerHTML =
    '<div class="no-data">同步雲端資料中...</div>';
  fetch(`${GAS_WEB_APP_URL}?action=read`)
    .then((r) => r.json())
    .then((data) => {
      expensesData = data || [];
      filterAndRecalculate();
    })
    .catch(() => {
      document.getElementById("expenses-list-container").innerHTML =
        '<div class="no-data" style="color:var(--danger)">歷史資料讀取失敗，請確認 Apps Script 設定。</div>';
    });
}

function toggleCollapse(id) {
  const el = document.getElementById(id);
  const arrow = document.getElementById("collapse-arrow");
  if (el.style.display === "none") {
    el.style.display = "block";
    arrow.textContent = "▼";
  } else {
    el.style.display = "none";
    arrow.textContent = "▲";
  }
}

// 四則運算
function evaluateMath(str) {
  let cleaned = str.replace(/[^0-9+\-*/.()]/g, "");
  if (!cleaned) return 0;
  try {
    let res = new Function(`return ${cleaned}`)();
    return typeof res === "number" && isFinite(res) ? res : 0;
  } catch (e) {
    try {
      let trimmed = cleaned.replace(/[+\-*/.]+$/, "");
      if (!trimmed) return 0;
      let res = new Function(`return ${trimmed}`)();
      return typeof res === "number" && isFinite(res) ? res : 0;
    } catch (err) {
      return 0;
    }
  }
}

function renderFormMembers() {
  const c = document.getElementById("members-container");
  c.innerHTML = "";
  members.forEach((name) => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.innerHTML = `
              <label class="member-label">
                <input type="checkbox" class="member-calc-check" value="${name}" id="check-${name}" onchange="handleCheckboxClick(this)">
                <span>${name}</span>
              </label>
              <div class="amount-right">
                <span class="result-amount" id="result-${name}">0</span>
                <input type="text" class="custom-amount-input" id="input-${name}" placeholder="0" style="display:none" oninput="handleCustomInput('${name}')">
                <span style="font-size:13px;color:var(--muted)">元</span>
              </div>`;
    c.appendChild(row);
  });
}

function handleCheckboxClick(cb) {
  const type = document.querySelector('input[name="split-type"]:checked').value;
  if (type === "個別自訂") {
    const inp = document.getElementById(`input-${cb.value}`);
    inp.disabled = !cb.checked;
    if (!cb.checked) inp.value = "";
    sumCustomAmounts();
  } else {
    calculateFormSplits();
  }
}

// 新增：當使用者在自訂金額輸入框打字時，自動勾選該成員
function handleCustomInput(name) {
  const inp = document.getElementById(`input-${name}`);
  const cb = document.getElementById(`check-${name}`);
  if (inp.value.trim() !== "") {
    cb.checked = true;
    inp.disabled = false;
  }
  sumCustomAmounts();
}

function handleFormTypeChange() {
  const type = document.querySelector('input[name="split-type"]:checked').value;
  const ta = document.getElementById("total-amount");
  const checks = document.querySelectorAll(".member-calc-check");
  const results = document.querySelectorAll(".result-amount");
  const customs = document.querySelectorAll(".custom-amount-input");
  const title = document.getElementById("section-title");
  const isEditing = document.getElementById("editing-id").value !== "";

  if (type === "全員均分") {
    title.textContent = "分攤明細 (全員均分)";
    ta.disabled = false;
    checks.forEach((c) => {
      c.checked = true;
      c.disabled = true;
    });
    customs.forEach((i) => (i.style.display = "none"));
    results.forEach((s) => (s.style.display = "inline"));
    calculateFormSplits();
  } else if (type === "指定人均分") {
    title.textContent = "選擇分攤成員 (均分)";
    ta.disabled = false;
    // 如果不是在編輯狀態，才做重置
    if (!isEditing) {
      checks.forEach((c) => {
        c.checked = false;
        c.disabled = false;
      });
    } else {
      checks.forEach((c) => c.disabled = false);
    }
    customs.forEach((i) => (i.style.display = "none"));
    results.forEach((s) => (s.style.display = "inline"));
    calculateFormSplits();
  } else {
    // 個別自訂模式
    title.textContent = "個別自訂金額 (支援 + - * / 算式)";
    ta.disabled = true;
    if (!isEditing) ta.value = "";
    
    checks.forEach((c) => {
      c.disabled = false;
      // 修正：移除 c.checked = false，避免覆蓋編輯狀態或打斷使用者操作
    });
    results.forEach((s) => (s.style.display = "none"));
    customs.forEach((i) => {
      i.style.display = "inline-block";
      const name = i.id.replace("input-", "");
      const cb = document.getElementById(`check-${name}`);
      i.disabled = !cb.checked;
      if (!isEditing && !cb.checked) i.value = "";
    });
    if (!isEditing) sumCustomAmounts();
  }
}

// 分帳
function calculateFormSplits() {
  if (
    document.querySelector('input[name="split-type"]:checked').value ===
    "個別自訂"
  )
    return;

  const totalValue = document.getElementById("total-amount").value;
  const total = evaluateMath(totalValue);
  const checked = Array.from(
    document.querySelectorAll(".member-calc-check:checked"),
  );
  const count = checked.length;

  members.forEach((name) => {
    const el = document.getElementById(`result-${name}`);
    if (el) el.textContent = "0";
  });

  if (!count || isNaN(total) || total <= 0) return;

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  checked.forEach((c, idx) => {
    // 餘數由前 remainder 個人分攤
    const amountCents = baseCents + (idx < remainder ? 1 : 0);
    const amount = amountCents / 100;

    document.getElementById(`result-${c.value}`).textContent =
      amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
  });
}

function sumCustomAmounts() {
  let total = 0;
  members.forEach((name) => {
    const cb = document.getElementById(`check-${name}`);
    const inp = document.getElementById(`input-${name}`);
    if (cb && cb.checked && inp.value) {
      total += evaluateMath(inp.value);
    }
  });
  document.getElementById("total-amount").value = total % 1 === 0 ? total.toString() : total.toFixed(2);
}

function resetForm() {
  document.getElementById("editing-id").value = "";
  document.getElementById("expense-item").value = "";
  document.getElementById("total-amount").value = "";
  document.getElementById("expense-note").value = "";
  document.getElementById("form-title").textContent = "新增消費項目";
  document.getElementById("submit-btn").textContent = "儲存記帳";
  document.getElementById("cancel-btn").style.display = "none";
  document.getElementById("expense-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("type-all").checked = true; // 預設改為全員均分較符合直覺
  selectPayer("大仙");
  handleFormTypeChange();
}

function startEdit(id) {
  const item = expensesData.find(
    (e) =>
      e.id == id || (e.id === undefined && new Date(e.date).getTime() == id),
  );
  if (!item) {
    alert("找不到該筆資料！");
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("editing-id").value = id;
  document.getElementById("form-title").textContent = "修改消費項目";
  document.getElementById("submit-btn").textContent = "更新記帳";
  document.getElementById("cancel-btn").style.display = "block";
  document.getElementById("expense-date").value = item.date;
  document.getElementById("expense-item").value = item.item;
  document.getElementById("expense-note").value = item.note || "";
  selectPayer(item.payer);
  
  if (item.type === "全員均分")
    document.getElementById("type-all").checked = true;
  else if (item.type === "指定人均分")
    document.getElementById("type-select").checked = true;
  else document.getElementById("type-custom").checked = true;

  // 先把打勾狀態填入，再呼叫 handleFormTypeChange
  members.forEach((name) => {
    const cb = document.getElementById(`check-${name}`);
    const amount = item.shares[name] || 0;
    cb.checked = amount > 0;
  });

  handleFormTypeChange();

  // 如果是個別自訂，在介面初始化後填入各別金額
  members.forEach((name) => {
    const amount = item.shares[name] || 0;
    if (item.type === "個別自訂") {
      const inp = document.getElementById(`input-${name}`);
      inp.value = amount > 0 ? amount : "";
    }
  });
  
  document.getElementById("total-amount").value = item.total;
  if (item.type !== "個別自訂") calculateFormSplits();
}

function deleteItem(id) {
  if (
    !confirm(
      "確定要刪除這筆記帳紀錄？此動作將同步移除雲端試算表上的資料且無法復原。",
    )
  )
    return;
  const btn = document.getElementById("submit-btn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "雲端刪除中...";
  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  })
    .then(() => {
      expensesData = expensesData.filter((e) => e.id != id);
      filterAndRecalculate();
      alert("資料已成功刪除！");
    })
    .catch(() => alert("刪除失敗，請檢查網路連線！"))
    .finally(() => {
      btn.disabled = false;
      btn.textContent = originalText;
      resetForm();
    });
}

function submitForm() {
  const editingId = document.getElementById("editing-id").value;
  const date = document.getElementById("expense-date").value;
  const item = document.getElementById("expense-item").value;
  const payer = document.getElementById("payer").value;
  const type = document.querySelector('input[name="split-type"]:checked').value;
  const total = evaluateMath(document.getElementById("total-amount").value);
  const note = document.getElementById("expense-note").value;
  
  if (!item) {
    alert("請填寫消費項目！");
    return;
  }
  if (total <= 0 || isNaN(total)) {
    alert("總金額必須大於 0！");
    return;
  }
  
  let shares = {};
  members.forEach((name) => {
    const cb = document.getElementById(`check-${name}`);
    if (type === "個別自訂") {
      const inp = document.getElementById(`input-${name}`);
      shares[name] =
        cb && cb.checked && inp.value ? evaluateMath(inp.value) : 0;
    } else {
      const resEl = document.getElementById(`result-${name}`);
      shares[name] =
        cb && cb.checked && resEl
          ? parseFloat(resEl.textContent)
          : 0;
    }
  });

  // 驗證自訂金額加總是否等於總金額（容許 0.05 元內的微小浮點數誤差）
  if (type === "個別自訂") {
    const sumShares = Object.values(shares).reduce((a, b) => a + b, 0);
    if (Math.abs(sumShares - total) > 0.05) {
      alert(`分攤金額總和 (${sumShares}) 與總金額 (${total}) 不符，請重新檢查！`);
      return;
    }
  }

  const finalId = editingId || "ID_" + Date.now();
  const action = editingId ? "update" : "create";
  const postData = {
    action,
    id: finalId,
    date,
    item,
    payer,
    total,
    type,
    shares,
    note,
  };
  
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = editingId ? "更新中..." : "寫入中...";
  
  fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postData),
  })
    .then(() => {
      const record = {
        id: finalId,
        date,
        item,
        payer,
        total,
        type,
        shares,
        note,
      };
      if (editingId) {
        const i = expensesData.findIndex((e) => e.id == editingId);
        if (i !== -1) expensesData[i] = record;
      } else expensesData.push(record);
      resetForm();
      filterAndRecalculate();
      alert(editingId ? "資料已成功更新！" : "記帳成功！資料已寫入試算表。");
    })
    .catch(() => alert("操作失敗，請檢查網路連線或 Apps Script 設定！"))
    .finally(() => {
      btn.disabled = false;
    });
}

function selectFilterPayer(name) {
  document.getElementById("filter-payer").value = name;
  document
    .querySelectorAll("#filterPayerGroup .btn-toggle-filter")
    .forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.textContent.trim() === (name === "全部" ? "全部成員" : name),
      );
    });
  filterAndRecalculate();
}

function changeDisplayLimit(limit) {
  currentDisplayLimit = limit;
  document.querySelectorAll(".btn-toggle-limit").forEach((btn) => {
    const text = btn.textContent.trim();
    if (limit === -1 && text === "全部") btn.classList.add("active");
    else if (limit !== -1 && text === `${limit}筆`) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  filterAndRecalculate();
}

function filterAndRecalculate() {
  const start = document.getElementById("filter-start").value;
  const end = document.getElementById("filter-end").value;
  const payerFilter = document.getElementById("filter-payer")
    ? document.getElementById("filter-payer").value
    : "全部";

  const filteredForSettlement = expensesData.filter((e) => {
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });
  calculateSettlementSummary(filteredForSettlement);

  const filteredForCards = filteredForSettlement.filter((e) => {
    if (payerFilter !== "全部" && e.payer !== payerFilter) return false;
    return true;
  });
  filteredForCards.sort((a, b) => b.date.localeCompare(a.date));

  let finalDisplayData = filteredForCards;
  if (currentDisplayLimit > 0) {
    finalDisplayData = filteredForCards.slice(0, currentDisplayLimit);
  }

  renderExpenseCards(finalDisplayData, filteredForCards.length);
}

function renderExpenseCards(data, totalCount) {
  const container = document.getElementById("expenses-list-container");
  if (data.length === 0) {
    container.innerHTML =
      '<div class="no-data">此時間區間與篩選條件內暫無記帳明細</div>';
    return;
  }
  const cards = document.createElement("div");
  cards.className = "expense-cards";
  data.forEach((exp) => {
    const targetId = exp.id || "ID_" + new Date(exp.date).getTime();
    const shareTags = Object.entries(exp.shares)
      .filter(([, v]) => v > 0)
      .map(([n, v]) => `<span class="share-tag">${n} ${v}元</span>`)
      .join("");
    const card = document.createElement("div");
    card.className = "expense-card";
    card.innerHTML = `
              <div class="expense-card-top">
                <span class="expense-card-title">${exp.item}</span>
                <span class="expense-card-type">${exp.type}</span>
              </div>
              <div class="expense-card-meta">
                <span>${exp.date}</span>
                <span class="payer">由 ${exp.payer} 付款</span>
                ${exp.note ? `<span style="color:var(--muted)">${exp.note}</span>` : ""}
              </div>
              <div class="expense-card-amount">${exp.total} 元</div>
              <div class="expense-card-shares">${shareTags}</div>
              <div class="expense-card-actions">
                <button class="action-btn edit-small-btn" onclick="startEdit('${targetId}')">編輯</button>
                <button class="action-btn delete-small-btn" onclick="deleteItem('${targetId}')">刪除</button>
              </div>`;
    cards.appendChild(card);
  });

  const countIndicator = document.createElement("div");
  countIndicator.style.cssText =
    "font-size: 12px; color: var(--muted); text-align: right; margin-top: 8px; padding-right: 4px;";
  countIndicator.textContent = `目前顯示 ${data.length} 筆 / 共 ${totalCount} 筆符合條件之明細`;

  container.innerHTML = "";
  container.appendChild(cards);
  container.appendChild(countIndicator);
}

function calculateSettlementSummary(data) {
  let s = {};
  members.forEach((m) => (s[m] = { paid: 0, owe: 0 }));

  data.forEach((exp) => {
    // 💡 核心修正：不再盲目抓 exp.total。
    // 我們直接計算這筆消費中，所有參與者分攤金額的「實際總和」
    let actualTotalCents = 0;
    
    if (exp.shares && typeof exp.shares === "object") {
      for (const name of members) {
        const shareCents = Math.round(parseFloat(exp.shares[name]) * 100) || 0;
        if (s[name] !== undefined) {
          s[name].owe += shareCents; // 每個人加上自己該付的錢
        }
        actualTotalCents += shareCents; // 累加這筆消費的真正總額
      }
    }

    // 付款人（代墊者）所獲得的債權，應該等於這筆消費真正的分攤總和
    if (s[exp.payer] !== undefined) {
      s[exp.payer].paid += actualTotalCents;
    }
  });

  const grid = document.getElementById("settlement-matrix-body");
  grid.innerHTML = "";

  const balancesCents = {};
  members.forEach((name) => {
    balancesCents[name] = s[name].paid - s[name].owe;
  });

  const fmtYuan = (cents) => (cents / 100).toFixed(2).replace(/\.00$/, "");

  members.forEach((name) => {
    const pYuan = fmtYuan(s[name].paid);
    const oYuan = fmtYuan(s[name].owe);
    const bCents = balancesCents[name];

    const bClass =
      bCents > 0
        ? "balance-positive"
        : bCents < 0
          ? "balance-negative"
          : "balance-zero";
    const bText =
      bCents > 0
        ? `+${fmtYuan(bCents)} 應收`
        : bCents < 0
          ? `${fmtYuan(-bCents)} 應付`
          : "0 已平帳";

    const card = document.createElement("div");
    card.className = "member-stat-card";
    card.innerHTML = `
      <div class="member-stat-name">
        <div class="member-avatar">${name.charAt(0)}</div>
        ${name}
      </div>
      <div class="stat-row"><span class="label">代墊金額</span><span class="val">${pYuan} 元</span></div>
      <div class="stat-row"><span class="label">應分攤</span><span class="val">${oYuan} 元</span></div>
      <span class="balance-badge ${bClass}">${bText}</span>
    `;
    grid.appendChild(card);
  });

  const rc = document.getElementById("summary-results-container");

  const creditors = members
    .filter((n) => balancesCents[n] > 0)
    .map((n) => ({ name: n, amount: balancesCents[n] }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = members
    .filter((n) => balancesCents[n] < 0)
    .map((n) => ({ name: n, amount: -balancesCents[n] }))
    .sort((a, b) => b.amount - a.amount);

  if (!creditors.length && !debtors.length) {
    rc.innerHTML =
      '<div class="no-data">所有帳目均已平帳，無須轉移債權。</div>';
    return;
  }

  const steps = [];
  let i = 0,
    j = 0,
    iteration = 0;

  while (i < creditors.length && j < debtors.length) {
    iteration++;
    const cr = creditors[i];
    const db = debtors[j];

    const tCents = Math.min(cr.amount, db.amount);

    const dbBefore = db.amount;
    const crBefore = cr.amount;
    const dbAfter = dbBefore - tCents;
    const crAfter = crBefore - tCents;

    steps.push({
      step: iteration,
      debtor: db.name,
      creditor: cr.name,
      tCents,
      dbBefore,
      crBefore,
      dbAfter,
      crAfter,
    });

    cr.amount = crAfter;
    db.amount = dbAfter;

    if (cr.amount === 0) i++;
    if (db.amount === 0) j++;
  }

  const wrapper = document.createElement("div");
  const list = document.createElement("div");
  list.className = "transfer-list";

  steps.forEach((st) => {
    const item = document.createElement("div");
    item.className = "transfer-item";
    item.style.cssText =
      "flex-direction:column;align-items:flex-start;gap:4px;";
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <div class="names">
          <span style="font-size:11px;color:var(--muted);margin-right:6px;">步驟${st.step}</span>
          <strong>${st.debtor}</strong>
          <span class="arrow">→</span>
          <strong>${st.creditor}</strong>
        </div>
        <span class="transfer-amount">${fmtYuan(st.tCents)} 元</span>
      </div>
      <div style="font-size:11px;color:var(--muted);line-height:1.9;padding-left:2px;">
        ${st.debtor} 應付：${fmtYuan(st.dbBefore)} − ${fmtYuan(st.tCents)} = ${fmtYuan(st.dbAfter)} 元<br>
        ${st.creditor} 應收：${fmtYuan(st.crBefore)} − ${fmtYuan(st.tCents)} = ${fmtYuan(st.crAfter)} 元
      </div>
    `;
    list.appendChild(item);
  });

  wrapper.appendChild(list);
  rc.innerHTML = "";
  rc.appendChild(wrapper);
}

function selectPayer(name) {
  document.getElementById("payer").value = name;
  document.querySelectorAll("#payerGroup .btn-toggle").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent.trim() === name);
  });
}