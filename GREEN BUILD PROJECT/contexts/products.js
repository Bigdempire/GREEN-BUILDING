let products = [];

function addProduct(product) {
  products.push(product);
  localStorage.setItem("products", JSON.stringify(products));
  showToast("Product added!");
}

function loadProducts() {
  const stored = localStorage.getItem("products");
  if (stored) products = JSON.parse(stored);
}
