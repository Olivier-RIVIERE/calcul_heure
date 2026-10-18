/* ────────────────────────────────────────────
   3D Heures — Application Logic
   ──────────────────────────────────────────── */

(function () {
  'use strict';

  // ─── Constants ───
  const STORAGE_KEY = '3d_heures_entries';
  const BACKUP_DATE_KEY = '3d_heures_last_backup';
  const BACKUP_REMINDER_DAY_OF_MONTH = 25; // Reminder starts on the 25th of each month

  // ─── DOM References ───
  const entryForm     = document.getElementById('entry-form');
  const entryDate     = document.getElementById('entry-date');
  const entryStart    = document.getElementById('entry-start');
  const entryEnd      = document.getElementById('entry-end');
  const entryPause    = document.getElementById('entry-pause');
  const entryNote     = document.getElementById('entry-note');
  const btnSubmit     = document.getElementById('btn-submit');

  const valToday      = document.getElementById('val-today');
  const valWeek       = document.getElementById('val-week');
  const valMonth      = document.getElementById('val-month');
  const valYear       = document.getElementById('val-year');

  const historyList   = document.getElementById('history-list');
  const emptyState    = document.getElementById('empty-state');
  const filterMonth   = document.getElementById('filter-month');
  const btnExport     = document.getElementById('btn-export');

  const editDialog    = document.getElementById('edit-dialog');
  const editForm      = document.getElementById('edit-form');
  const editDate      = document.getElementById('edit-date');
  const editStart     = document.getElementById('edit-start');
  const editEnd       = document.getElementById('edit-end');
  const editPause     = document.getElementById('edit-pause');
  const editNote      = document.getElementById('edit-note');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  const deleteDialog      = document.getElementById('delete-dialog');
  const btnCancelDelete   = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete  = document.getElementById('btn-confirm-delete');

  const toastContainer = document.getElementById('toast-container');

  // Converter
  const convHours    = document.getElementById('conv-hours');
  const convMinutes  = document.getElementById('conv-minutes');
  const convDecimal  = document.getElementById('conv-decimal');
  const convResult   = document.getElementById('converter-result');

  // Backup
  const btnBackupShare     = document.getElementById('btn-backup-share');
  const importFile         = document.getElementById('import-file');
  const backupInfo         = document.getElementById('backup-info');
  const backupReminder     = document.getElementById('backup-reminder');
  const btnReminderBackup  = document.getElementById('btn-reminder-backup');
  const btnReminderDismiss = document.getElementById('btn-reminder-dismiss');

  // ─── State ───
  let entries = [];
  let editingId = null;
  let deletingId = null;

  // ─── Helpers ───

  /** Generate a unique ID */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Format minutes to "Xh00" */
  function formatDuration(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  }

  /** Format minutes to decimal (e.g. 90 → "1,50") */
  function formatDecimal(totalMinutes) {
    const dec = totalMinutes / 60;
    return dec.toFixed(2).replace('.', ',');
  }

  /** Parse "HH:MM" time string to minutes since midnight */
  function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  /** Calculate work duration in minutes */
  function calcDuration(start, end, pause) {
    let startMin = timeToMinutes(start);
    let endMin   = timeToMinutes(end);
    // Handle overnight shifts
    if (endMin <= startMin) endMin += 24 * 60;
    return Math.max(0, endMin - startMin - (pause || 0));
  }

  /** Get ISO date string for today */
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Get the Monday of the week containing the given date string */
  function getWeekMonday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust for Sunday
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  }

  /** Get "YYYY-MM" from a date string */
  function getYearMonth(dateStr) {
    return dateStr.slice(0, 7);
  }

  /** Get "YYYY" from a date string */
  function getYear(dateStr) {
    return dateStr.slice(0, 4);
  }

  /** Format a date string to a readable French format */
  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /** Format "YYYY-MM" to readable French month/year */
  function formatMonthLabel(ym) {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  // ─── Storage ───

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      entries = raw ? JSON.parse(raw) : [];
    } catch {
      entries = [];
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // ─── Toast ───

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icon = type === 'success' ? '✓' : '✕';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = `toastOut 300ms ease forwards`;
      toast.addEventListener('animationend', () => toast.remove());
    }, 2500);
  }

  // ─── Dashboard ───

  function updateDashboard() {
    const today     = todayISO();
    const thisWeek  = getWeekMonday(today);
    const thisMonth = getYearMonth(today);
    const thisYear  = getYear(today);

    let mToday = 0, mWeek = 0, mMonth = 0, mYear = 0;

    for (const e of entries) {
      const dur = calcDuration(e.start, e.end, e.pause);
      if (e.date === today) mToday += dur;
      if (getWeekMonday(e.date) === thisWeek) mWeek += dur;
      if (getYearMonth(e.date) === thisMonth) mMonth += dur;
      if (getYear(e.date) === thisYear) mYear += dur;
    }

    animateValue(valToday, mToday);
    animateValue(valWeek, mWeek);
    animateValue(valMonth, mMonth);
    animateValue(valYear, mYear);
  }

  /** Smooth number animation for stat values */
  function animateValue(element, targetMinutes) {
    const targetText = formatDuration(targetMinutes);
    // Simple immediate update (keeps things snappy)
    element.textContent = targetText;
  }

  // ─── Filter ───

  function populateFilter() {
    const months = new Set();
    for (const e of entries) {
      months.add(getYearMonth(e.date));
    }

    const sorted = [...months].sort().reverse();
    const current = filterMonth.value;

    filterMonth.innerHTML = '<option value="all">Tous les mois</option>';
    for (const ym of sorted) {
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = formatMonthLabel(ym);
      filterMonth.appendChild(opt);
    }

    // Restore selection
    if (current && sorted.includes(current)) {
      filterMonth.value = current;
    }
  }

  // ─── History Rendering ───

  function renderHistory() {
    // Clear existing entries (keep empty-state)
    const existing = historyList.querySelectorAll('.history-entry');
    existing.forEach(el => el.remove());

    const filter = filterMonth.value;
    let filtered = entries;
    if (filter && filter !== 'all') {
      filtered = entries.filter(e => getYearMonth(e.date) === filter);
    }

    // Sort by date desc, then by start desc
    filtered = [...filtered].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.start.localeCompare(a.start);
    });

    if (filtered.length === 0) {
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';

    for (const entry of filtered) {
      const dur = calcDuration(entry.start, entry.end, entry.pause);
      const el = document.createElement('div');
      el.className = 'history-entry';
      el.dataset.id = entry.id;

      const pauseStr = entry.pause ? ` · ${entry.pause}min pause` : '';
      const noteStr  = entry.note ? `<span class="entry-note" title="${escapeHtml(entry.note)}">${escapeHtml(entry.note)}</span>` : '';

      el.innerHTML = `
        <span class="entry-date">${formatDateShort(entry.date)}</span>
        <div class="entry-details">
          <span class="entry-times">${entry.start} → ${entry.end}${pauseStr}</span>
          ${noteStr}
        </div>
        <div class="entry-duration-wrap">
          <span class="entry-duration">${formatDuration(dur)}</span>
          <span class="entry-decimal">${formatDecimal(dur)}</span>
        </div>
        <div class="entry-actions">
          <button class="btn-icon-only" title="Modifier" data-action="edit" data-id="${entry.id}" aria-label="Modifier">✎</button>
          <button class="btn-icon-only btn-icon-only--danger" title="Supprimer" data-action="delete" data-id="${entry.id}" aria-label="Supprimer">✕</button>
        </div>
      `;
      historyList.appendChild(el);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Full Refresh ───

  function refresh() {
    populateFilter();
    renderHistory();
    updateDashboard();
  }

  // ─── Add Entry ───

  entryForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const date  = entryDate.value;
    const start = entryStart.value;
    const end   = entryEnd.value;
    const pause = parseInt(entryPause.value, 10) || 0;
    const note  = entryNote.value.trim();

    if (!date || !start || !end) return;

    const dur = calcDuration(start, end, pause);
    if (dur <= 0) {
      showToast('Les horaires semblent incorrects', 'error');
      return;
    }

    const entry = { id: uid(), date, start, end, pause, note };
    entries.push(entry);
    saveEntries();

    // Reset form
    entryStart.value = '';
    entryEnd.value = '';
    entryPause.value = '0';
    entryNote.value = '';

    showToast(`${formatDuration(dur)} ajoutées pour le ${formatDateShort(date)}`);
    refresh();
  });

  // ─── History Actions (Edit / Delete) ───

  historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'edit') {
      openEditDialog(id);
    } else if (action === 'delete') {
      openDeleteDialog(id);
    }
  });

  // ─── Edit Dialog ───

  function openEditDialog(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    editingId = id;
    editDate.value  = entry.date;
    editStart.value = entry.start;
    editEnd.value   = entry.end;
    editPause.value = entry.pause || 0;
    editNote.value  = entry.note || '';

    editDialog.showModal();
  }

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingId) return;

    const entry = entries.find(e => e.id === editingId);
    if (!entry) return;

    const dur = calcDuration(editStart.value, editEnd.value, parseInt(editPause.value, 10) || 0);
    if (dur <= 0) {
      showToast('Les horaires semblent incorrects', 'error');
      return;
    }

    entry.date  = editDate.value;
    entry.start = editStart.value;
    entry.end   = editEnd.value;
    entry.pause = parseInt(editPause.value, 10) || 0;
    entry.note  = editNote.value.trim();

    saveEntries();
    editDialog.close();
    editingId = null;
    showToast('Entrée modifiée');
    refresh();
  });

  btnCancelEdit.addEventListener('click', () => {
    editDialog.close();
    editingId = null;
  });

  // ─── Delete Dialog ───

  function openDeleteDialog(id) {
    deletingId = id;
    deleteDialog.showModal();
  }

  btnConfirmDelete.addEventListener('click', () => {
    if (!deletingId) return;
    entries = entries.filter(e => e.id !== deletingId);
    saveEntries();
    deleteDialog.close();
    deletingId = null;
    showToast('Entrée supprimée');
    refresh();
  });

  btnCancelDelete.addEventListener('click', () => {
    deleteDialog.close();
    deletingId = null;
  });

  // ─── Filter ───

  filterMonth.addEventListener('change', () => {
    renderHistory();
  });

  // ─── Export CSV ───

  btnExport.addEventListener('click', () => {
    if (entries.length === 0) {
      showToast('Aucune donnée à exporter', 'error');
      return;
    }

    const filter = filterMonth.value;
    let data = entries;
    if (filter && filter !== 'all') {
      data = entries.filter(e => getYearMonth(e.date) === filter);
    }

    // Sort chronologically
    data = [...data].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start.localeCompare(b.start);
    });

    const rows = [['Date', 'Début', 'Fin', 'Pause (min)', 'Durée (min)', 'Durée', 'Décimal', 'Note']];
    for (const e of data) {
      const dur = calcDuration(e.start, e.end, e.pause);
      rows.push([e.date, e.start, e.end, e.pause || 0, dur, formatDuration(dur), formatDecimal(dur), `"${(e.note || '').replace(/"/g, '""')}"`]);
    }

    // Add totals row
    const totalMin = data.reduce((sum, e) => sum + calcDuration(e.start, e.end, e.pause), 0);
    rows.push(['', '', '', '', totalMin, formatDuration(totalMin), formatDecimal(totalMin), 'TOTAL']);

    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = filter && filter !== 'all' ? filter : 'toutes';
    a.download = `3d_heures_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV téléchargé');
  });

  // ─── Init ───

  function init() {
    // Set today's date as default
    entryDate.value = todayISO();

    loadEntries();
    refresh();
    initConverter();
    initBackup();
    initPWA();
  }

  // ─── Converter Logic ───

  function initConverter() {
    let isUpdating = false;

    /** Time → Decimal */
    function timeToDecimal() {
      if (isUpdating) return;
      const h = parseInt(convHours.value, 10) || 0;
      const m = parseInt(convMinutes.value, 10) || 0;
      if (h === 0 && m === 0 && !convHours.value && !convMinutes.value) {
        convResult.classList.remove('active');
        return;
      }
      const totalMin = h * 60 + m;
      const dec = (totalMin / 60).toFixed(2).replace('.', ',');
      isUpdating = true;
      convDecimal.value = (totalMin / 60).toFixed(2);
      isUpdating = false;
      convResult.textContent = `${h}h${m.toString().padStart(2, '0')} = ${dec} (décimal pour ta fiche)`;
      convResult.classList.add('active');
    }

    /** Decimal → Time */
    function decimalToTime() {
      if (isUpdating) return;
      const dec = parseFloat(convDecimal.value);
      if (isNaN(dec) || dec < 0) {
        convResult.classList.remove('active');
        return;
      }
      const totalMin = Math.round(dec * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      isUpdating = true;
      convHours.value = h;
      convMinutes.value = m;
      isUpdating = false;
      convResult.textContent = `${dec.toFixed(2).replace('.', ',')} = ${h}h${m.toString().padStart(2, '0')}`;
      convResult.classList.add('active');
    }

    convHours.addEventListener('input', timeToDecimal);
    convMinutes.addEventListener('input', timeToDecimal);
    convDecimal.addEventListener('input', decimalToTime);
  }

  // ─── Backup / Restore Logic ───

  function initBackup() {
    updateBackupInfo();
    checkBackupReminder();

    // ─── Export / Share JSON backup ───
    if (btnBackupShare) {
      btnBackupShare.addEventListener('click', performBackup);
    }
    if (btnReminderBackup) {
      btnReminderBackup.addEventListener('click', performBackup);
    }

    async function performBackup() {
      if (entries.length === 0) {
        showToast('Aucune donnée à sauvegarder', 'error');
        return;
      }

      const backup = {
        app: '3d_heures',
        version: 1,
        exportedAt: new Date().toISOString(),
        entriesCount: entries.length,
        entries: entries
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const dateStr = todayISO().replace(/-/g, '');
      const fileName = `3d_heures_backup_${dateStr}.json`;

      // 1. Try Web Share API with file (works natively on Chrome Android)
      let shared = false;
      try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Sauvegarde Heures 3D',
            text: `Sauvegarde de mes heures (${entries.length} entrées)`,
            files: [file]
          });
          shared = true;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // User intentionally closed the Android share sheet
          return;
        }
        // Other error, fallback to download
      }

      // 2. Fallback to classic file download
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Save backup date
      localStorage.setItem(BACKUP_DATE_KEY, new Date().toISOString());
      updateBackupInfo();
      hideReminder();
      showToast(shared ? 'Sauvegarde partagée avec succès' : `Sauvegarde téléchargée (${entries.length} entrées)`);
    }

    // ─── Import JSON backup ───
    if (importFile) {
      importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);

            // Validate structure
            if (!data.entries || !Array.isArray(data.entries)) {
              showToast('Fichier invalide : pas de données trouvées', 'error');
              return;
            }

            // Validate entries have required fields
            const valid = data.entries.every(e =>
              e.id && e.date && e.start && e.end
            );
            if (!valid) {
              showToast('Fichier invalide : entrées malformées', 'error');
              return;
            }

            // Merge: add entries that don't already exist (by id)
            const existingIds = new Set(entries.map(e => e.id));
            let added = 0;
            for (const entry of data.entries) {
              if (!existingIds.has(entry.id)) {
                entries.push(entry);
                added++;
              }
            }

            if (added === 0 && data.entries.length > 0) {
              showToast(`Toutes les ${data.entries.length} entrées existent déjà`);
            } else {
              saveEntries();
              refresh();
              showToast(`${added} entrée(s) restaurée(s) sur ${data.entries.length}`);
            }
          } catch {
            showToast('Erreur de lecture du fichier', 'error');
          }

          // Reset file input for re-use
          importFile.value = '';
        };
        reader.readAsText(file);
      });
    }

    // ─── Reminder dismiss ───
    if (btnReminderDismiss) {
      btnReminderDismiss.addEventListener('click', () => {
        sessionStorage.setItem('backup_reminder_dismissed', '1');
        hideReminder();
      });
    }
  }

  function updateBackupInfo() {
    if (!backupInfo) return;
    const lastBackup = localStorage.getItem(BACKUP_DATE_KEY);
    if (lastBackup) {
      const d = new Date(lastBackup);
      const label = d.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      backupInfo.textContent = `Dernière sauvegarde : ${label}`;
      backupInfo.classList.add('has-info');
    } else {
      backupInfo.textContent = 'Aucune sauvegarde effectuée pour le moment.';
      backupInfo.classList.remove('has-info');
    }
  }

  function checkBackupReminder() {
    if (!backupReminder || entries.length === 0) return;
    if (sessionStorage.getItem('backup_reminder_dismissed') === '1') return;

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    // Trigger reminder from the 25th of each month onwards
    if (currentDay >= BACKUP_REMINDER_DAY_OF_MONTH) {
      const lastBackup = localStorage.getItem(BACKUP_DATE_KEY);
      if (lastBackup) {
        const lastDate = new Date(lastBackup);
        const lastMonthKey = `${lastDate.getFullYear()}-${(lastDate.getMonth() + 1).toString().padStart(2, '0')}`;
        // If backed up this month on or after the 25th, no need to nag
        if (lastMonthKey === currentMonthKey && lastDate.getDate() >= BACKUP_REMINDER_DAY_OF_MONTH) {
          return;
        }
      }
      backupReminder.hidden = false;
    }
  }

  function hideReminder() {
    if (backupReminder) {
      backupReminder.hidden = true;
    }
  }

  // ─── PWA & Service Worker ───
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('SW enregistré:', reg.scope))
          .catch((err) => console.warn('SW erreur:', err));
      });
    }

    // Install prompt handling
    const installContainer = document.getElementById('install-container');
    const btnInstall = document.getElementById('btn-install-app');
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installContainer) {
        installContainer.hidden = false;
      }
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Installation en cours...');
        }
        deferredPrompt = null;
        if (installContainer) {
          installContainer.hidden = true;
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installContainer) {
        installContainer.hidden = true;
      }
      showToast('3D Heures ajoutée à votre écran d’accueil !');
    });
  }

  init();
})();
