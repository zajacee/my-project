document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('content-form');
    const searchBar = document.getElementById('search-bar');
    const fileInput = document.getElementById('images');
    const fileNameDisplay = document.getElementById('file-name');
    const recentContentSection = document.getElementById('recent-content');

    // Store selected files globally
    let selectedFiles = [];

    // Load and display recently added content from localStorage
    const loadRecentContent = () => {
        const contentList = JSON.parse(localStorage.getItem('contentList')) || [];

        // Clear the current displayed content
        recentContentSection.innerHTML = '<h3>Nedávno pridané</h3>';

        // Display each content item
        contentList.forEach(item => {
            const contentElement = document.createElement('div');
            contentElement.classList.add('content-item');
            contentElement.innerHTML = `
                <h4>${item.topic}</h4>
                <p>${item.content}</p>
                <small>${item.date}</small>
                <!-- Optionally, display files (if you store images) -->
            `;
            recentContentSection.appendChild(contentElement);
        });
    };

    loadRecentContent(); // Initial load of content when page loads

    // Handle content submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();  // Prevent the default form submission

        // Grab the input values from the form
        const topic = document.getElementById('title').value.trim();
        const content = document.getElementById('content').value.trim();
        const category = document.getElementById('category').value;

        // Ensure values are not empty
        if (!topic || !content) {
            alert("Vyplňte všetky polia!");
            return;
        }

        // Create a content object to store in localStorage
        const newContent = {
            topic,
            content,
            category,
            date: new Date().toLocaleString(),
        };

        // Retrieve existing content from localStorage, or initialize empty array
        let contentList = JSON.parse(localStorage.getItem('contentList')) || [];

        // Add new content to the list
        contentList.push(newContent);

        // Save the updated content list back to localStorage
        localStorage.setItem('contentList', JSON.stringify(contentList));

        // Reset the form
        form.reset();
        fileNameDisplay.textContent = "Neboli vybraté žiadne súbory"; // Reset file name text
        selectedFiles = [];  // Clear the stored files
        alert("Obsah bol úspešne pridaný!");  // Show success message

        loadRecentContent(); // Reload the recent content after adding new one
    });

    // Implement search functionality
    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.content-item');

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Handle multiple file selection and append to the selected files array
    fileInput.addEventListener('change', function(event) {
        const files = Array.from(event.target.files);

        // Append new files to the previously selected ones
        selectedFiles = [...selectedFiles, ...files];

        if (selectedFiles.length > 0) {
            const fileNames = selectedFiles.map(file => file.name);
            fileNameDisplay.textContent = fileNames.join(", "); // Display all file names
        } else {
            fileNameDisplay.textContent = "Neboli vybraté žiadne súbory"; // No files selected
        }
    });
});
