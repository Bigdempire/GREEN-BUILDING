let comparisonList = [];

function addToComparison(material) {
  if (comparisonList.length < 4) {
    comparisonList.push(material);
    showToast(`${material.name} added to comparison`);
  } else {
    alert("You can only compare up to 4 materials.");
  }
}

function clearComparison() {
  comparisonList = [];
}
