 if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    // If not logged in, redirect to login page
    window.location.href = 'index.html';
  }
    document.getElementById('rehabBtn').addEventListener('click', () => {
      window.location.href = 'rehab.html';
    });

    document.getElementById('newBtn').addEventListener('click', () => {
      window.location.href = 'newlaying.html';
    });
     document.getElementById('logoutBtn').addEventListener('click', () => {
      sessionStorage.clear(); 
      window.location.href = 'index.html';
    });