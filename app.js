(() => {
  const KEY = "starttiny-v1";
  const prompts = [
    "Open the document and write the first messy sentence.",
    "Make the task smaller: only do the first 2 minutes.",
    "Delete one distraction tab, then begin.",
    "Write a tiny checklist with just 3 steps.",
    "Set a timer and work until it rings once.",
    "You do not need motivation first — just a tiny start."
  ];
  const tips = {
    tired: "Use a 10-minute sprint, keep the bar very low, and avoid perfection.",
    okay: "Start with one clear task and a normal 25-minute sprint.",
    energized: "Try a deeper 40–50 minute sprint and save a bigger task for now.",
    overwhelmed: "Dump everything into notes first, then choose just one tiny next action."
  };
  const priorityWeight = { high: 3, medium: 2, low: 1 };

  let data = {
    tasks: [],
    notes: [],
    sessions: 0,
    focus: 25,
    break: 5,
    mode: "focus",
    sort: "smart",
    energy: "okay"
  };
  let timer = null;
  let running = false;
  let remaining = data.focus * 60;

  const $ = id => document.getElementById(id);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) data = {...data, ...saved};
    } catch {}
    remaining = (data.mode === "focus" ? data.focus : data.break) * 60;
    $("sortSelect").value = data.sort;
    setEnergy(data.energy, false);
    renderAll();
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    renderStats();
  }

  function renderStats() {
    $("sessionCount").textContent = data.sessions;
    $("openCount").textContent = data.tasks.filter(t => !t.done).length;
  }

  function setTimerLabel() {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    $("timerDisplay").textContent = `${mins}:${String(secs).padStart(2, "0")}`;
    const total = (data.mode === "focus" ? data.focus : data.break) * 60;
    $("timerProgress").style.width = `${Math.max(0, Math.min(100, ((total - remaining) / total) * 100))}%`;
    $("durationLabel").textContent = `${data.mode === "focus" ? data.focus : data.break} min`;
  }

  function start() {
    if (running) return;
    running = true;
    $("startBtn").textContent = "▶ Running";
    timer = setInterval(() => {
      remaining -= 1;
      setTimerLabel();
      if (remaining <= 0) finishPhase();
    }, 1000);
  }

  function stopTimer() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    $("startBtn").textContent = "▶ Start";
  }

  function finishPhase() {
    stopTimer();
    if (data.mode === "focus") {
      data.sessions += 1;
      data.mode = "break";
      remaining = data.break * 60;
      $("promptText").textContent = "Nice work. Take a short break, then come back.";
      notify("Focus session complete", "Time for a short break.");
    } else {
      data.mode = "focus";
      remaining = data.focus * 60;
      $("promptText").textContent = "Break is over. One tiny step is enough.";
      notify("Break complete", "Ready for your next focus sprint.");
    }
    save();
    renderModeButtons();
    setTimerLabel();
  }

  function notify(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {body});
    }
  }

  function resetTimer() {
    stopTimer();
    remaining = (data.mode === "focus" ? data.focus : data.break) * 60;
    setTimerLabel();
  }

  function skipPhase() {
    stopTimer();
    data.mode = data.mode === "focus" ? "break" : "focus";
    remaining = (data.mode === "focus" ? data.focus : data.break) * 60;
    save();
    renderModeButtons();
    setTimerLabel();
  }

  function switchMode(mode) {
    stopTimer();
    data.mode = mode;
    remaining = (mode === "focus" ? data.focus : data.break) * 60;
    save();
    renderModeButtons();
    setTimerLabel();
  }

  function renderModeButtons() {
    document.querySelectorAll(".mode-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === data.mode);
    });
  }

  function addTask() {
    const text = $("taskInput").value.trim();
    if (!text) return;
    data.tasks.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      text,
      priority: $("priorityInput").value,
      deadline: $("deadlineInput").value || "",
      created: Date.now(),
      done: false
    });
    $("taskInput").value = "";
    $("deadlineInput").value = "";
    save();
    renderTasks();
    $("unstuckText").textContent = `Tiny start: ${tinyStep(data.tasks[data.tasks.length - 1].text)}`;
  }

  function toggleTask(id) {
    const task = data.tasks.find(t => t.id === id);
    if (task) task.done = !task.done;
    save();
    renderTasks();
  }

  function deleteTask(id) {
    data.tasks = data.tasks.filter(t => t.id !== id);
    save();
    renderTasks();
  }

  function dueMeta(task) {
    if (!task.deadline) return "No deadline";
    const d = new Date(task.deadline + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0) return "Overdue";
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    return `Due ${d.toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
  }

  function metaClass(task) {
    if (!task.deadline) return "meta";
    const d = new Date(task.deadline + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    return `meta ${diff < 0 ? "overdue" : diff === 0 ? "today" : ""}`;
  }

  function renderTasks() {
    const sort = data.sort;
    const tasks = [...data.tasks].sort((a,b) => {
      if (sort === "deadline") {
        if (!a.deadline && !b.deadline) return a.created - b.created;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (sort === "priority") return (b.done-a.done) || (priorityWeight[b.priority]-priorityWeight[a.priority]) || (a.created-b.created);
      if (sort === "newest") return b.created-a.created;
      if (sort === "oldest") return a.created-b.created;
      if (sort === "completion") return (a.done-b.done) || (a.created-b.created);
      // Smart: incomplete first, deadline first when present, then priority, then newest.
      if (a.done !== b.done) return a.done-b.done;
      if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      return (priorityWeight[b.priority]-priorityWeight[a.priority]) || (b.created-a.created);
    });

    $("taskList").innerHTML = tasks.length ? tasks.map(task => `
      <div class="task-item ${task.done ? "done" : ""}">
        <input class="task-check" type="checkbox" ${task.done ? "checked" : ""} data-id="${task.id}">
        <div>
          <div class="task-title">${escapeHTML(task.text)}</div>
          <div class="task-meta">
            <span class="meta">${task.priority} priority</span>
            <span class="${metaClass(task)}">${dueMeta(task)}</span>
          </div>
        </div>
        <button class="task-delete" data-delete="${task.id}" title="Delete task">✕</button>
      </div>
    `).join("") : `<div class="empty-state">No tasks yet. Add one thing that matters.</div>`;

    document.querySelectorAll(".task-check").forEach(cb => cb.addEventListener("change", () => toggleTask(cb.dataset.id)));
    document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteTask(btn.dataset.delete)));
    const done = data.tasks.filter(t=>t.done).length;
    $("taskSummary").textContent = `${done} done · ${data.tasks.length - done} left`;
    renderStats();
  }

  function addNote() {
    const text = $("noteInput").value.trim();
    if (!text) return;
    data.notes.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      text,
      created: Date.now()
    });
    $("noteInput").value = "";
    save();
    renderNotes();
  }

  function deleteNote(id) {
    data.notes = data.notes.filter(n => n.id !== id);
    save();
    renderNotes();
  }

  function renderNotes() {
    $("noteList").innerHTML = data.notes.length ? data.notes.map(note => `
      <article class="note-card">
        <button class="note-delete" data-note-delete="${note.id}" title="Delete note">✕</button>
        <p>${escapeHTML(note.text)}</p>
      </article>
    `).join("") : `<div class="empty-state">Nothing saved yet. Use this space for reminders, ideas and distractions.</div>`;
    document.querySelectorAll("[data-note-delete]").forEach(btn => btn.addEventListener("click", () => deleteNote(btn.dataset.noteDelete)));
  }

  function tinyStep(text) {
    const options = [
      `Open the file or materials for “${text}”.`,
      `Do the easiest 2-minute part of “${text}”.`,
      `Write one rough line about “${text}”.`,
      `Break “${text}” into 3 tiny steps and do only step 1.`
    ];
    return options[Math.floor(Math.random()*options.length)];
  }

  function helpMeStart() {
    const task = data.tasks.find(t => !t.done);
    if (!task) {
      $("unstuckText").textContent = "Add one task or dump everything into notes, then choose one next action.";
      return;
    }
    $("unstuckText").textContent = tinyStep(task.text);
  }

  function setEnergy(energy, shouldSave = true) {
    data.energy = energy;
    document.querySelectorAll("[data-energy]").forEach(btn => btn.classList.toggle("selected", btn.dataset.energy === energy));
    $("energyTip").textContent = tips[energy];
    if (shouldSave) save();
  }

  function applyPreset(focus, breakMin) {
    stopTimer();
    data.focus = focus; data.break = breakMin; data.mode = "focus";
    remaining = focus * 60;
    document.querySelectorAll(".presets button").forEach(btn => btn.classList.toggle("selected", Number(btn.dataset.focus)===focus && Number(btn.dataset.break)===breakMin));
    save(); renderModeButtons(); setTimerLabel();
  }

  function applyCustom() {
    const focus = Math.max(1, Math.min(240, Number($("customFocus").value)||25));
    const breakMin = Math.max(1, Math.min(120, Number($("customBreak").value)||5));
    applyPreset(focus, breakMin);
  }

  function requestNotifications() {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }

  function toggleFocusMode() {
    document.body.classList.toggle("focus-only");
    $("focusModeBtn").textContent = document.body.classList.contains("focus-only") ? "Show full layout" : "Focus mode";
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function renderAll() {
    renderStats();
    renderTasks();
    renderNotes();
    renderModeButtons();
    setTimerLabel();
  }

  $("startBtn").addEventListener("click", () => { requestNotifications(); start(); });
  $("pauseBtn").addEventListener("click", stopTimer);
  $("resetBtn").addEventListener("click", resetTimer);
  $("skipBtn").addEventListener("click", skipPhase);
  $("focusModeBtn").addEventListener("click", toggleFocusMode);
  $("addTask").addEventListener("click", addTask);
  $("taskInput").addEventListener("keydown", e => { if (e.key==="Enter") addTask(); });
  $("addNote").addEventListener("click", addNote);
  $("noteInput").addEventListener("keydown", e => { if ((e.metaKey||e.ctrlKey) && e.key==="Enter") addNote(); });
  $("clearNotes").addEventListener("click", () => { if (data.notes.length && confirm("Clear all saved notes?")) { data.notes=[]; save(); renderNotes(); }});
  $("clearData").addEventListener("click", () => { if (confirm("Reset all local data, tasks, notes and sessions?")) { localStorage.removeItem(KEY); location.reload(); }});
  $("helpBtn").addEventListener("click", helpMeStart);
  $("newPrompt").addEventListener("click", () => $("promptText").textContent = prompts[Math.floor(Math.random()*prompts.length)]);
  $("applyCustom").addEventListener("click", applyCustom);
  $("sortSelect").addEventListener("change", e => { data.sort = e.target.value; save(); renderTasks(); });
  document.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));
  document.querySelectorAll(".presets button").forEach(btn => btn.addEventListener("click", () => applyPreset(Number(btn.dataset.focus), Number(btn.dataset.break))));
  document.querySelectorAll("[data-energy]").forEach(btn => btn.addEventListener("click", () => setEnergy(btn.dataset.energy)));

  load();
})();