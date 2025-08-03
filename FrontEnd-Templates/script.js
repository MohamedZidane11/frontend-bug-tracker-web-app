class BugTracker {
    constructor() {
        this.bugs = JSON.parse(localStorage.getItem('bugs') || '[]');
        this.nextId = parseInt(localStorage.getItem('nextBugId') || '1');
        this.filteredBugs = [...this.bugs];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderBugs();
        this.updateStats();
    }

    bindEvents() {
        // Form submission
        document.getElementById('bugForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitBug();
        });

        // Search and filter
        document.getElementById('searchInput').addEventListener('input', () => this.filterBugs());
        document.getElementById('severityFilter').addEventListener('change', () => this.filterBugs());
        document.getElementById('statusFilter').addEventListener('change', () => this.filterBugs());
    }

    submitBug() {
        const form = document.getElementById('bugForm');
        const formData = new FormData(form);
        
        const bug = {
            id: this.nextId++,
            title: formData.get('title').trim(),
            description: formData.get('description').trim(),
            severity: formData.get('severity'),
            reporter: formData.get('reporter').trim(),
            status: 'open',
            dateCreated: new Date().toISOString(),
            dateUpdated: new Date().toISOString()
        };

        this.bugs.unshift(bug); // Add to beginning for newest first
        this.saveBugs();
        this.filterBugs(); // This will update the display
        this.updateStats();
        
        // Reset form
        form.reset();
        
        // Show success feedback
        this.showNotification('Bug report submitted successfully!', 'success');
    }

    filterBugs() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const severityFilter = document.getElementById('severityFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredBugs = this.bugs.filter(bug => {
            const matchesSearch = bug.title.toLowerCase().includes(searchTerm) || 
                                bug.description.toLowerCase().includes(searchTerm);
            const matchesSeverity = !severityFilter || bug.severity === severityFilter;
            const matchesStatus = !statusFilter || bug.status === statusFilter;
            
            return matchesSearch && matchesSeverity && matchesStatus;
        });

        this.renderBugs();
    }

    renderBugs() {
        const tbody = document.getElementById('bugTableBody');
        
        if (this.filteredBugs.length === 0) {
            tbody.innerHTML = '<tr class="no-bugs"><td colspan="6">No bugs match the current filters.</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredBugs.map(bug => `
            <tr class="fade-in">
                <td>#${bug.id}</td>
                <td>
                    <strong>${this.escapeHtml(bug.title)}</strong>
                    <div style="font-size: 12px; color: #666; margin-top: 2px;">
                        ${this.escapeHtml(bug.description.substring(0, 50))}${bug.description.length > 50 ? '...' : ''}
                    </div>
                </td>
                <td>
                    <span class="severity-badge severity-${bug.severity}">
                        ${bug.severity}
                    </span>
                </td>
                <td>${this.escapeHtml(bug.reporter)}</td>
                <td>
                    <span class="status-badge status-${bug.status}" onclick="bugTracker.toggleStatus(${bug.id})">
                        ${bug.status}
                    </span>
                </td>
                <td>${new Date(bug.dateCreated).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    toggleStatus(bugId) {
        const bug = this.bugs.find(b => b.id === bugId);
        if (bug) {
            bug.status = bug.status === 'open' ? 'resolved' : 'open';
            bug.dateUpdated = new Date().toISOString();
            this.saveBugs();
            this.filterBugs();
            this.updateStats();
            
            const newStatus = bug.status === 'open' ? 'reopened' : 'resolved';
            this.showNotification(`Bug #${bugId} marked as ${newStatus}!`, 'info');
        }
    }

    updateStats() {
        const totalBugs = this.bugs.length;
        const openBugs = this.bugs.filter(bug => bug.status === 'open').length;
        const closedBugs = totalBugs - openBugs;
        
        // Calculate most common severity
        const severityCounts = this.bugs.reduce((acc, bug) => {
            acc[bug.severity] = (acc[bug.severity] || 0) + 1;
            return acc;
        }, {});
        
        const mostCommonSeverity = Object.keys(severityCounts).reduce((a, b) => 
            severityCounts[a] > severityCounts[b] ? a : b, '-'
        );

        // Update UI
        document.getElementById('totalBugs').textContent = totalBugs;
        document.getElementById('openBugs').textContent = openBugs;
        document.getElementById('closedBugs').textContent = closedBugs;
        document.getElementById('commonSeverity').textContent = mostCommonSeverity === '-' ? '-' : mostCommonSeverity.charAt(0).toUpperCase() + mostCommonSeverity.slice(1);
    }

    saveBugs() {
        localStorage.setItem('bugs', JSON.stringify(this.bugs));
        localStorage.setItem('nextBugId', this.nextId.toString());
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the bug tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bugTracker = new BugTracker();
});