const auth = {
  isLoggedIn: localStorage.getItem("loggedIn") === "true",
  login(user) {
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("user", user);
    showToast("Login successful!");
  },
  logout() {
    localStorage.clear();
    showToast("Logged out.");
    navigateTo("login");
  }
};
