class BugTracker {
    constructor() {
        this.bugs = JSON.parse(localStorage.getItem('bugs') || '[]');
        this.nextId = parseInt(localStorage.getItem('nextBugId') || '1');
        this.filteredBugs = [...this.bugs];
        this.currentPage = 'create';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderBugs();
        this.updateStats();
        this.showPage('create');
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.getAttribute('data-page');
                this.showPage(page);
            });
        });

        // Form submission
        document.getElementById('bugForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitBug();
        });

        // Search and filter (only bind if elements exist)
        const searchInput = document.getElementById('searchInput');
        const severityFilter = document.getElementById('severityFilter');
        const statusFilter = document.getElementById('statusFilter');

        if (searchInput) searchInput.addEventListener('input', () => this.filterBugs());
        if (severityFilter) severityFilter.addEventListener('change', () => this.filterBugs());
        if (statusFilter) statusFilter.addEventListener('change', () => this.filterBugs());
    }

    showPage(pageId) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(`${pageId}Page`).classList.add('active');

        this.currentPage = pageId;

        // Refresh data for the current page
        if (pageId === 'list') {
            this.filterBugs();
        } else if (pageId === 'stats') {
            this.updateStats();
            this.updateDetailedStats();
        }
    }

    submitBug() {
        const form = document.getElementById('bugForm');
        const formData = new FormData(form);
        
        // Validate form data
        const title = formData.get('title').trim();
        const description = formData.get('description').trim();
        const severity = formData.get('severity');
        const reporter = formData.get('reporter').trim();

        if (!title || !description || !severity || !reporter) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        const bug = {
            id: this.nextId++,
            title: title,
            description: description,
            severity: severity,
            reporter: reporter,
            status: 'open',
            dateCreated: new Date().toISOString(),
            dateUpdated: new Date().toISOString()
        };

        this.bugs.unshift(bug); // Add to beginning for newest first
        this.saveBugs();
        
        // Reset form
        form.reset();
        
        // Show success message
        this.showToast(`Bug #${bug.id} "${title}" has been created successfully!`, 'success');
        
        // Update UI if on other pages
        this.updateStats();
        if (this.currentPage === 'list') {
            this.filterBugs();
        }
    }

    filterBugs() {
        const searchInput = document.getElementById('searchInput');
        const severityFilter = document.getElementById('severityFilter');
        const statusFilter = document.getElementById('statusFilter');

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const severityFilterValue = severityFilter ? severityFilter.value : '';
        const statusFilterValue = statusFilter ? statusFilter.value : '';

        this.filteredBugs = this.bugs.filter(bug => {
            const matchesSearch = bug.title.toLowerCase().includes(searchTerm) || 
                                bug.description.toLowerCase().includes(searchTerm);
            const matchesSeverity = !severityFilterValue || bug.severity === severityFilterValue;
            const matchesStatus = !statusFilterValue || bug.status === statusFilterValue;
            
            return matchesSearch && matchesSeverity && matchesStatus;
        });

        this.renderBugs();
    }

    renderBugs() {
        const tbody = document.getElementById('bugTableBody');
        if (!tbody) return;
        
        if (this.filteredBugs.length === 0) {
            tbody.innerHTML = '<tr class="no-bugs"><td colspan="7">No bugs match the current filters.</td></tr>';
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
                <td>
                    <button class="btn btn-danger" onclick="bugTracker.deleteBug(${bug.id})">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    toggleStatus(bugId) {
        const bug = this.bugs.find(b => b.id === bugId);
        if (bug) {
            const oldStatus = bug.status;
            bug.status = bug.status === 'open' ? 'resolved' : 'open';
            bug.dateUpdated = new Date().toISOString();
            this.saveBugs();
            this.filterBugs();
            this.updateStats();
            
            const action = bug.status === 'open' ? 'reopened' : 'resolved';
            this.showToast(`Bug #${bugId} has been ${action}!`, 'info');
        }
    }

    deleteBug(bugId) {
        const bug = this.bugs.find(b => b.id === bugId);
        if (bug && confirm(`Are you sure you want to delete bug #${bugId}: "${bug.title}"?`)) {
            this.bugs = this.bugs.filter(b => b.id !== bugId);
            this.saveBugs();
            this.filterBugs();
            this.updateStats();
            this.showToast(`Bug #${bugId} has been deleted!`, 'warning');
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

        // Update UI elements if they exist
        const elements = {
            totalBugs: document.getElementById('totalBugs'),
            openBugs: document.getElementById('openBugs'),
            closedBugs: document.getElementById('closedBugs'),
            commonSeverity: document.getElementById('commonSeverity')
        };

        if (elements.totalBugs) elements.totalBugs.textContent = totalBugs;
        if (elements.openBugs) elements.openBugs.textContent = openBugs;
        if (elements.closedBugs) elements.closedBugs.textContent = closedBugs;
        if (elements.commonSeverity) {
            elements.commonSeverity.textContent = mostCommonSeverity === '-' ? '-' : 
                mostCommonSeverity.charAt(0).toUpperCase() + mostCommonSeverity.slice(1);
        }
    }

    updateDetailedStats() {
        // Update severity breakdown
        const severityCounts = this.bugs.reduce((acc, bug) => {
            acc[bug.severity] = (acc[bug.severity] || 0) + 1;
            return acc;
        }, { low: 0, medium: 0, high: 0, critical: 0 });

        const elements = {
            lowCount: document.getElementById('lowCount'),
            mediumCount: document.getElementById('mediumCount'),
            highCount: document.getElementById('highCount'),
            criticalCount: document.getElementById('criticalCount')
        };

        if (elements.lowCount) elements.lowCount.textContent = severityCounts.low;
        if (elements.mediumCount) elements.mediumCount.textContent = severityCounts.medium;
        if (elements.highCount) elements.highCount.textContent = severityCounts.high;
        if (elements.criticalCount) elements.criticalCount.textContent = severityCounts.critical;

        // Update activity summary
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const bugsThisWeek = this.bugs.filter(bug => 
            new Date(bug.dateCreated) >= oneWeekAgo
        ).length;

        const resolvedThisWeek = this.bugs.filter(bug => 
            bug.status === 'resolved' && new Date(bug.dateUpdated) >= oneWeekAgo
        ).length;

        // Calculate average resolution time
        const resolvedBugs = this.bugs.filter(bug => bug.status === 'resolved');
        let avgResolutionTime = 'N/A';
        
        if (resolvedBugs.length > 0) {
            const totalResolutionTime = resolvedBugs.reduce((sum, bug) => {
                const created = new Date(bug.dateCreated);
                const updated = new Date(bug.dateUpdated);
                return sum + (updated - created);
            }, 0);
            
            const avgMilliseconds = totalResolutionTime / resolvedBugs.length;
            const avgDays = Math.round(avgMilliseconds / (1000 * 60 * 60 * 24));
            avgResolutionTime = `${avgDays} days`;
        }

        const activityElements = {
            thisWeekCount: document.getElementById('thisWeekCount'),
            resolvedThisWeekCount: document.getElementById('resolvedThisWeekCount'),
            avgResolutionTime: document.getElementById('avgResolutionTime')
        };

        if (activityElements.thisWeekCount) activityElements.thisWeekCount.textContent = bugsThisWeek;
        if (activityElements.resolvedThisWeekCount) activityElements.resolvedThisWeekCount.textContent = resolvedThisWeek;
        if (activityElements.avgResolutionTime) activityElements.avgResolutionTime.textContent = avgResolutionTime;
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

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'toast-message';
        messageDiv.textContent = message;
        
        toast.appendChild(messageDiv);
        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toastContainer.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);

        // Add click to dismiss
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toastContainer.removeChild(toast);
                    }
                }, 300);
            }
        });
    }
}

// Initialize the bug tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bugTracker = new BugTracker();
});