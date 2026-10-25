let __ans = [];
let __answerRun = 0;
function renderAnswerLines(lines) {
  const fragment = document.createDocumentFragment();
  lines.filter(Boolean).forEach(txt => {
    const line = document.createElement("div");
    const parsed = new DOMParser().parseFromString(String(txt), "text/html");
    line.textContent = parsed.body.textContent || "";
    fragment.appendChild(line);
  });
  ansShow.replaceChildren(fragment);
}
async function getAns() {
  const run = ++__answerRun;
  const current = () => run === __answerRun;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  btn0.disabled = true;
  ansStatus.textContent = "Đang lấy và điền đáp án…";
  __ans = [];
  ansShow.replaceChildren();
  try {
    if (!chrome.runtime?.sendMessage) throw new Error("Hãy tải lại trang sau khi cập nhật extension.");
    const datax = await new Promise((resolve, reject) => {
      const abort = () => reject(new Error("Lấy đáp án quá lâu. Hãy thử lại."));
      controller.signal.addEventListener("abort", abort, {once:true});
      chrome.runtime.sendMessage({ type: "ansUrl" }, result => {
        controller.signal.removeEventListener("abort", abort);
        if (chrome.runtime.lastError) reject(new Error("Hãy tải lại trang để kết nối extension."));
        else resolve(result);
      });
    });
    const { aRequest: data, autho } = datax || {};
    if (!data || !autho) throw new Error("Chưa có dữ liệu bài học. Hãy mở câu cần làm rồi bấm lại.");
    const res = await fetch(data, { headers: { Authorization: autho }, signal:controller.signal });
    if (!res.ok) throw new Error("Không lấy được đáp án. Hãy thử mở lại bài học.");
    const { i: { q: qs = [] } = {} } = await res.json();
    if (!current()) return false;
    const arrC = [],
      arrS = [];
    qs.forEach((q) => {
      (q.al || []).forEach((ch) => {
        (ch.a || []).forEach((op) => {
          const txt = op.txt || "";
          if (op.c === 1 || op.c === "1" || op.c === true) {
            arrC.push(txt);
            arrS.push(txt);
          } else if (!op.c) {
            arrS.push(txt);
          }
        });
      });
    });
    __ans = arrC.filter(Boolean);
    renderAnswerLines(arrS);
    clearTimeout(timer);
    // The floating answers panel must not intercept the drop position.
    sumElement.style.pointerEvents = "none";
    const result = await globalThis.EDAnsAutoFill.fill(qs, current);
    if (!current()) return false;
    if (result.supported) {
      if (result.displayAnswers.length) renderAnswerLines(result.displayAnswers);
      ansStatus.textContent = result.message || `Đã điền ${result.filled}/${result.total} ô.`;
    } else {
      const applied = applyCorrectAnswers();
      ansStatus.textContent = applied ? "Đã áp dụng đáp án." : "Đã lấy đáp án; dạng này chưa được hỗ trợ tự điền.";
    }
    return true;
  } catch (error) {
    if (current()) ansStatus.textContent = error.name === "AbortError" ? "Lấy đáp án quá lâu. Hãy thử lại." : error.message;
    return false;
  } finally {
    clearTimeout(timer);
    if (current()) {
      btn0.disabled = false;
      sumElement.style.pointerEvents = "";
    }
  }
}

const clickElement = (sel) => document.querySelector(sel)?.click();
const goToNextItem = () => clickElement("#learning__nextItem");

document.addEventListener(
  "keydown",
  (e) => {
    if (e.code === "KeyV" || e.key?.toLowerCase() === "v") {
      if (
        e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey ||
        e.repeat || e.isComposing || inTypingContext(e)
      ) return;
      e.preventDefault();
      if (!btn0.disabled) btn0.click();
      return;
    }
    if (
      ![32, "Space", " ", "Spacebar"].includes(
        e.keyCode === 32 ? 32 : e.code || e.key
      )
    )
      return;
    if (inTypingContext(e)) return;
    e.preventDefault();

    const afterGoToNext = () => {
      setTimeout(() => {
        getAns();
      }, 700);
    };

    const startBtn = findVisible(".btnStartTest");
    if (startBtn) {
      startBtn.click();
      afterGoToNext();
      return;
    }

    if (!findVisible("#learning__nextItem")) {
      const bottomSubmit = findVisible(
        ".learning__submitTestLink, #learning__submitTestItem"
      );
      if (bottomSubmit) {
        bottomSubmit.click();
        return;
      }
    }

    clickElement("#CTrackerPlayBtn");
    clickElement("#play-pause");
    setTimeout(() => {
      clickElement("#CTrackerPlayBtn");
      clickElement("#play-pause");
      setTimeout(() => {
        goToNextItem();
        afterGoToNext();
      }, 100);
    }, 200);
  },
  false
);

const isVisible = (el) =>
  !!(el && (el.offsetParent !== null || el.getClientRects().length));
const findVisible = (sel) =>
  [...document.querySelectorAll(sel)].find(isVisible) || null;

const isTextInput = (el) => {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  const type = el.type?.toLowerCase();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT")
    return ![
      "checkbox",
      "radio",
      "button",
      "submit",
      "range",
      "color",
      "file",
      "image",
      "reset",
      "hidden",
    ].includes(type);
  return el.getAttribute?.("role") === "textbox";
};

const inTypingContext = (e) => {
  try {
    return isTextInput(document.activeElement) || isTextInput(e?.target);
  } catch (_) {
    return false;
  }
};

const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

function applyCorrectAnswers() {
  try {
    if (!__ans?.length) return false;
    const set = new Set(__ans.map(norm));

    const mcqLabels = document.querySelectorAll(".prMCQ__answerLabel");
    if (mcqLabels.length) {
      let n1 = 0;
      mcqLabels.forEach((l) => {
        if (set.has(norm(l.innerText || l.textContent || ""))) {
          l.click();
          n1++;
        }
      });
      if (n1 > 0) return true;
    }

    const conts = document.querySelectorAll(".lessonMultipleAnswer");
    if (conts.length) {
      let toggled = 0;
      conts.forEach((c) => {
        const txtEl =
          c.querySelector(".multiTextInline") ||
          c.querySelector(".multiText") ||
          c.querySelector(".radioTextWrapper") ||
          c;
        const t = norm(txtEl?.innerText || txtEl?.textContent || "");
        const shouldSelect = set.has(t);
        const inp = c.querySelector("input.lessonMultipleCheck");
        const isSelected = !!(
          inp?.checked ||
          inp?.classList.contains("selected") ||
          c.classList.contains("check")
        );
        const clickTarget = c.querySelector("label.overlayCheckbox") || c;
        if (shouldSelect !== isSelected) {
          clickTarget.click();
          toggled++;
        }
      });
      if (toggled > 0) return true;
    }

    const ddls = document.querySelectorAll(".prFITB__DDLOptionsW");
    if (ddls.length) {
      const cnt = {};
      __ans.forEach((ans) => {
        const s = norm(ans);
        if (s) cnt[s] = (cnt[s] || 0) + 1;
      });
      let changed = 0;
      ddls.forEach((w) => {
        const sel = w.querySelector(".DDLOptions__selected");
        if (!sel) return;
        const cur = norm(sel.innerText || sel.textContent || "");
        if (cnt[cur] > 0) {
          cnt[cur]--;
          return;
        }
        sel.click();
        const list = (w.parentElement || w).querySelector(".DDLOptions__list");
        if (!list) {
          setTimeout(() => applyCorrectAnswers(), 60);
          return;
        }
        for (const it of list.querySelectorAll(".DDLOptions__listItem")) {
          const t = norm(it.innerText || it.textContent || "");
          if (cnt[t] > 0 || (!Object.keys(cnt).length && set.has(t))) {
            it.click();
            cnt[t] = (cnt[t] || 0) - 1;
            changed++;
            break;
          }
        }
      });
      return changed > 0 || ddls.length > 0;
    }
    return false;
  } catch (_) {
    return false;
  }
}
let isDragging = false,
  dragModeEnabled = false,
  dragOffsetX = 0,
  dragOffsetY = 0;

const sumElement = document.createElement("div");
sumElement.className = "carry";
document.body.appendChild(sumElement);

const btn0 = document.createElement("button");
btn0.innerHTML = "Lấy lại đáp án";
btn0.className = "buttonX";
btn0.title = "Lấy lại đáp án (phím V)";
btn0.setAttribute("aria-keyshortcuts", "V");
btn0.onclick = () => getAns();
sumElement.appendChild(btn0);

const ansShow = document.createElement("div");
ansShow.className = "ansShow";
sumElement.appendChild(ansShow);

const ansStatus = document.createElement("div");
ansStatus.className = "ansStatus";
ansStatus.setAttribute("role", "status");
sumElement.appendChild(ansStatus);

btn0.addEventListener("dblclick", (e) => {
  dragModeEnabled = true;
  btn0.style.backgroundColor = "orange";
  btn0.style.cursor = "move";
  setTimeout(() => {
    dragModeEnabled = false;
    btn0.style.backgroundColor = "lightgreen";
    btn0.style.cursor = "pointer";
  }, 3000);
  e.preventDefault();
});

btn0.addEventListener("mousedown", (e) => {
  if (e.button === 0 && dragModeEnabled) {
    isDragging = true;
    const rect = sumElement.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  }
});

document.addEventListener("mousemove", (e) => {
  if (isDragging && dragModeEnabled) {
    sumElement.style.left = e.clientX - dragOffsetX + "px";
    sumElement.style.top = e.clientY - dragOffsetY + "px";
    e.preventDefault();
  }
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});


// Cancel an in-flight fill before the exercise is replaced by navigation.
document.addEventListener("click", event => {
  if (event.target.closest?.("#learning__nextItem, #learning__prevItem, .learning__tasksNav_task, .learning__dropDownList_item")) {
    __answerRun++;
    __ans = [];
    btn0.disabled = false;
    sumElement.style.pointerEvents = "";
    ansShow.replaceChildren();
    ansStatus.textContent = "";
  }
}, true);
