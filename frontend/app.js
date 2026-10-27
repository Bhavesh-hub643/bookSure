const API_URL = 'http://localhost:3000';

// App State
let authToken = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentEvents = []; // Cache to pick a random event for testing

// DOM Elements
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const navLinks = document.getElementById('navLinks');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const btnShowLogin = document.getElementById('btnShowLogin');
const btnShowRegister = document.getElementById('btnShowRegister');
const eventsGrid = document.getElementById('eventsGrid');
const bookingsList = document.getElementById('bookingsList');
const welcomeMessage = document.getElementById('welcomeMessage');

// Admin DOM Elements
const adminFabContainer = document.getElementById('adminFabContainer');
const btnAdminPanel = document.getElementById('btnAdminPanel');
const adminModal = document.getElementById('adminModal');
const btnCloseAdmin = document.getElementById('btnCloseAdmin');
const btnReseed = document.getElementById('btnReseed');
const btnRunTest = document.getElementById('btnRunTest');
const testLogWindow = document.getElementById('testLogWindow');

// Initial Setup
function init() {
  updateUI();
  setupEventListeners();
  if (authToken) {
    loadDashboard();
  }
}

// Ensure UI shows the right section (auth or dashboard)
function updateUI() {
  if (authToken) {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    adminFabContainer.classList.remove('hidden'); // Show test fab when logged in
    navLinks.innerHTML = `
      <span style="font-weight:600; font-size:0.9rem;">Welcome, ${currentUser.name}</span>
      <button class="btn-secondary ml-4" onclick="logout()" style="margin-left:1rem;">Logout</button>
    `;
    welcomeMessage.innerText = `Hello, ${currentUser.name}.`;
  } else {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    adminFabContainer.classList.add('hidden');
    navLinks.innerHTML = ``;
  }
}

// Toast Notifications
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Setup Event Listeners
function setupEventListeners() {
  // Auth Toggles
  btnShowLogin.addEventListener('click', () => toggleAuthModes(true));
  btnShowRegister.addEventListener('click', () => toggleAuthModes(false));

  // Forms
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);

  // Refresh
  document.getElementById('btnRefreshEvents').addEventListener('click', fetchEvents);

  // Admin Panel
  btnAdminPanel.addEventListener('click', () => adminModal.classList.remove('hidden'));
  btnCloseAdmin.addEventListener('click', () => adminModal.classList.add('hidden'));
  btnReseed.addEventListener('click', handleReseed);
  btnRunTest.addEventListener('click', handleRunTest);
}

function toggleAuthModes(isLogin) {
  if (isLogin) {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    btnShowLogin.classList.add('active');
    btnShowRegister.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    btnShowLogin.classList.remove('active');
    btnShowRegister.classList.add('active');
  }
}

// ─── Api Interactions ─────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (data.success) {
      authToken = data.data.token;
      currentUser = data.data.user;
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showToast('Logged in successfully!');
      updateUI();
      loadDashboard();
    } else {
      showToast(data.message || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();
    
    if (data.success) {
      showToast('Registration successful! Please login.');
      toggleAuthModes(true);
      document.getElementById('loginEmail').value = email;
    } else {
      showToast(data.message || data.errors?.[0]?.msg || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Server connection failed.', 'error');
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateUI();
  showToast('Logged out.');
}

// ─── Dashboard Management ───────────────────────────────────────────────────

function loadDashboard() {
  fetchEvents();
  fetchBookings();
}

async function fetchEvents() {
  eventsGrid.innerHTML = `<div class="loading-spinner">Loading events...</div>`;
  try {
    // Stage 2 Cache-Aside
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();
    
    if (data.success) {
      currentEvents = data.data; // Store globally for test script
      renderEvents(data.data);
    }
  } catch (err) {
    eventsGrid.innerHTML = `<div>Failed to load events.</div>`;
  }
}

async function renderEvents(events) {
  eventsGrid.innerHTML = '';
  if (events.length === 0) {
    eventsGrid.innerHTML = `<div>No events available currently.</div>`;
    return;
  }

  // Sequentially load available seats individually (simulate rich UX)
  for (const event of events) {
    // We fetch individually to populate exactly what Redis knows
    let realTimeSeats = '...';
    try {
      const evtRes = await fetch(`${API_URL}/events/${event.event_id}`);
      const evtData = await evtRes.json();
      if(evtData.success) realTimeSeats = evtData.data.available_seats;
    } catch(e) {}
    
    const isSoldOut = realTimeSeats === 0;

    const el = document.createElement('div');
    el.className = 'event-card';
    el.innerHTML = `
      <div class="event-details">
        <span style="font-size: 0.8rem; font-weight:600;">${new Date(event.date).toLocaleDateString()}</span>
        <h3>${event.title}</h3>
        <p>${event.location}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="price-tag">₹${parseFloat(event.price).toFixed(2)}</span>
        </div>
      </div>
      <div class="seat-status">
        <div>
          <span class="seat-indicator" style="${isSoldOut ? 'color: white; background: black' : ''}">
            ${realTimeSeats} Seats Available
          </span>
        </div>
        <div class="book-action">
          <input type="number" id="qty-${event.event_id}" min="1" max="10" value="1" class="book-input" ${isSoldOut ? 'disabled' : ''}>
          <button class="btn-primary" style="flex:1;" onclick="bookEvent('${event.event_id}')" ${isSoldOut ? 'disabled' : ''}>${isSoldOut ? 'Sold Out' : 'Book Now'}</button>
        </div>
      </div>
    `;
    eventsGrid.appendChild(el);
  }
}

window.bookEvent = async function(eventId) {
  const qtyInput = document.getElementById(`qty-${eventId}`);
  const tickets_count = parseInt(qtyInput.value) || 1;
  const btn = qtyInput.nextElementSibling;
  
  btn.innerText = "⏳";
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        event_id: eventId,
        tickets_count: tickets_count
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast(`Successfully booked ${tickets_count} ticket(s)!`);
      fetchBookings(); // refresh UI
      fetchEvents();   // Update seat counts
    } else {
      showToast(data.message || 'Failed to book', 'error');
    }
  } catch (err) {
    showToast('Network error during booking.', 'error');
  } finally {
    btn.innerText = "Book Now";
    btn.disabled = false;
  }
}

async function fetchBookings() {
  try {
    const res = await fetch(`${API_URL}/users/${currentUser.user_id}/bookings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    
    bookingsList.innerHTML = '';
    if (data.success && data.data && data.data.length > 0) {
      data.data.forEach(b => {
        const div = document.createElement('div');
        div.className = 'booking-item';
        div.innerHTML = `
          <div>
            <strong>${b.event_title}</strong>
            <p style="font-size:0.85rem; color:var(--text-muted)">Tickets: ${b.tickets_count}</p>
          </div>
          <div>
            <span style="font-weight:600; font-size:0.8rem;">
              [Status: ${b.status}]
            </span>
          </div>
        `;
        bookingsList.appendChild(div);
      });
    } else {
      bookingsList.innerHTML = `<p style="color:var(--text-muted)">Nothing here yet.</p>`;
    }
  } catch (err) {
    bookingsList.innerHTML = `<p>Failed to load bookings</p>`;
  }
}

// ─── Admin Controller Logics ──────────────────────────────────────────────────

async function handleReseed() {
  if(!confirm("Are you sure? This will wipe all current events and bookings globally.")) return;
  btnReseed.disabled = true;
  btnReseed.innerText = "🔄 Reseeding...";
  
  try {
    const res = await fetch(`${API_URL}/admin/reseed`, { method: 'POST' });
    const data = await res.json();
    
    if(data.success) {
      showToast("Database successfully wiped and reseeded!");
      loadDashboard();
    } else {
      showToast("Failed to reseed database.", "error");
    }
  } catch(e) {
    showToast("Network Error", "error");
  } finally {
    btnReseed.disabled = false;
    btnReseed.innerText = "🔄 Clear & Reseed DB";
  }
}

function handleRunTest() {
  if(currentEvents.length === 0) {
      showToast("No active events found. Try Reseeding first!", "error");
      return;
  }

  // Force scroll to bottom function
  const updateScroll = () => { testLogWindow.scrollTop = testLogWindow.scrollHeight; };

  // Setup params
  btnRunTest.disabled = true;
  testLogWindow.innerHTML = "> Establishing Server-Sent Event connection...\n";
  const eventToAttack = currentEvents[0].event_id; // Pick first event
  const userId = currentUser.user_id;

  // Use EventSource for SSE streaming
  const url = new URL(`${API_URL}/admin/test/concurrency`);
  url.searchParams.append('eventId', eventToAttack);
  url.searchParams.append('userId', userId);
  url.searchParams.append('concurrent', '50'); // Fire 50 booking reqs at once
  url.searchParams.append('tickets', '2'); // Try to buy 2 each
  
  const tokenForTest = authToken || "no-token";
  url.searchParams.append('token', tokenForTest);

  const eventSource = new EventSource(url);

  eventSource.onmessage = function(event) {
    // We stringify'd string data in backend so we parse it here to print
    try {
        const textChunk = JSON.parse(event.data);
        testLogWindow.innerHTML += textChunk;
        updateScroll();
        
        // If it sends the finish marker, we cleanly close
        if(textChunk.includes('[Process Finished - Check Results!]')) {
            eventSource.close();
            btnRunTest.disabled = false;
            fetchEvents();    // update grid
            fetchBookings();  // update user's bookings from this barrage!
        }
    } catch(err) {
        testLogWindow.innerHTML += event.data;
        updateScroll();
    }
  };

  eventSource.onerror = function() {
    testLogWindow.innerHTML += "\n> SSE Connection closed or errored out.\n";
    eventSource.close();
    btnRunTest.disabled = false;
    updateScroll();
  };
}

// Start
init();
