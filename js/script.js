class BugTracker {
    constructor() {
        // API Configuration - REPLACE WITH YOUR RAILWAY URL
        this.API_CONFIG = {
            BASE_URL: 'https://web-production-8cf83.up.railway.app', // Replace with your Railway URL
            ENDPOINTS: {
                bugs: '/api/bugs/',
                bugStats: '/api/bug-stats/',
                bugDetail: (id) => `/api/bugs/${id}/`
            }
        };

        this.bugs = [];
        this.filteredBugs = [];
        this.currentPage = 'create';
        this.loading = false;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.testConnection();
        await this.loadBugsFromAPI();
        this.showPage('create');
    }

    // Test connection to Django backend
    async testConnection() {
        try {
            const response = await fetch(`${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.bugs}`);
            if (response.ok) {
                console.log('✅ Successfully connected to Django backend');
                this.showToast('Connected to backend successfully!', 'success');
            } else {
                console.warn('⚠️ Backend connection issue:', response.status);
                this.showToast('Warning: Backend connection issue', 'warning');
            }
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            this.showToast('Error: Could not connect to backend', 'error');
        }
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
    
        // Search and filter
        const searchInput = document.getElementById('searchInput');
        const severityFilter = document.getElementById('severityFilter');
        const statusFilter = document.getElementById('statusFilter');
    
        if (searchInput) searchInput.addEventListener('input', () => this.filterBugs());
        if (severityFilter) severityFilter.addEventListener('change', () => this.filterBugs());
        if (statusFilter) statusFilter.addEventListener('change', () => this.filterBugs());
    
        // ✅ Event delegation for status dropdowns and other dynamic elements
        document.addEventListener('click', (e) => {
            // Handle toggle status dropdown
            if (e.target.matches('[data-action="toggle-status"]') || e.target.closest('[data-action="toggle-status"]')) {
                e.preventDefault();
                e.stopPropagation();
                
                const targetElement = e.target.matches('[data-action="toggle-status"]') ? 
                                    e.target : e.target.closest('[data-action="toggle-status"]');
                const bugId = targetElement.getAttribute('data-bug-id');
                
                if (bugId) {
                    console.log('Toggling dropdown for bug:', bugId);
                    this.toggleStatusDropdown(bugId);
                }
            }
    
            // Handle update status
            else if (e.target.matches('[data-action="update-status"]') || e.target.closest('[data-action="update-status"]')) {
                e.preventDefault();
                e.stopPropagation();
                
                const targetElement = e.target.matches('[data-action="update-status"]') ? 
                                    e.target : e.target.closest('[data-action="update-status"]');
                const bugId = targetElement.getAttribute('data-bug-id');
                const status = targetElement.getAttribute('data-status');
                
                if (bugId && status) {
                    console.log('Updating bug status:', bugId, 'to:', status);
                    this.updateBugStatus(bugId, status);
                }
            }
    
            // Close dropdowns when clicking outside
            else if (!e.target.closest('.status-dropdown')) {
                this.closeStatusDropdowns();
            }
        });
    }

    async showPage(pageId) {
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
            await this.loadBugsFromAPI();
            this.filterBugs();
        } else if (pageId === 'stats') {
            await this.loadBugsFromAPI();
            await this.updateStatsFromAPI();
        }
    }

    // Load bugs from Django API
    async loadBugsFromAPI() {
        if (this.loading) return;
        
        try {
            this.loading = true;
            const response = await fetch(`${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.bugs}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.bugs = await response.json();
            this.filteredBugs = [...this.bugs];
            
        } catch (error) {
            console.error('Error loading bugs:', error);
            this.showToast('Error loading bugs: ' + error.message, 'error');
            this.bugs = [];
            this.filteredBugs = [];
        } finally {
            this.loading = false;
        }
    }

    async submitBug() {
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

        const bugData = {
            title: title,
            description: description,
            severity: severity,
            reporter: reporter // Django expects 'reporter_name'
        };

        try {
            this.showToast('Submitting bug report...', 'info');
            
            const response = await fetch(`${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.bugs}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bugData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newBug = await response.json();
            
            // Reset form
            form.reset();
            
            // Show success message
            this.showToast(`Bug #${newBug.id} "${title}" has been created successfully!`, 'success');
            
            // Refresh data if on other pages
            await this.loadBugsFromAPI();
            if (this.currentPage === 'list') {
                this.filterBugs();
            } else if (this.currentPage === 'stats') {
                await this.updateStatsFromAPI();
            }
            
        } catch (error) {
            console.error('Error creating bug:', error);
            this.showToast('Error creating bug: ' + error.message, 'error');
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
            const matchesStatus = !statusFilterValue || this.getDisplayStatus(bug) === statusFilterValue;
            
            return matchesSearch && matchesSeverity && matchesStatus;
        });

        this.renderBugs();
    }

    // Convert Django status to display status
    getDisplayStatus(bug) {
        // Return the actual status from Django
        return bug.status || 'open';
    }

    // Get available status transitions
    getStatusTransitions(currentStatus) {
        const transitions = {
            'open': ['in_progress', 'resolved', 'closed'],
            'in_progress': ['open', 'resolved', 'closed'],
            'resolved': ['open', 'in_progress', 'closed'],
            'closed': ['open', 'in_progress', 'resolved']
        };
        return transitions[currentStatus] || ['resolved'];
    }

    // Get status display name
    getStatusDisplayName(status) {
        const statusNames = {
            'open': 'Open',
            'in_progress': 'In Progress',
            'resolved': 'Resolved',
            'closed': 'Closed'
        };
        return statusNames[status] || status;
    }

    // Get status CSS class
    getStatusClass(status) {
        const statusClasses = {
            'open': 'status-open',
            'in_progress': 'status-progress',
            'resolved': 'status-resolved',
            'closed': 'status-closed'
        };
        return statusClasses[status] || 'status-open';
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
                <td>${this.escapeHtml(bug.reporter_name)}</td>
                <td>
                    <div class="status-dropdown">
                        <span class="status-badge ${this.getStatusClass(this.getDisplayStatus(bug))}" 
                              data-action="toggle-status" 
                              data-bug-id="${bug.id}"
                              style="cursor: pointer;">
                            ${this.getStatusDisplayName(this.getDisplayStatus(bug))} ▼
                        </span>
                        <div class="status-options" id="statusOptions${bug.id}" style="display: none; position: absolute; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000; min-width: 120px;">
                            ${this.getStatusTransitions(this.getDisplayStatus(bug)).map(status => `
                                <div class="status-option" 
                                     data-action="update-status" 
                                     data-bug-id="${bug.id}" 
                                     data-status="${status}"
                                     style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;">
                                    <span class="status-badge ${this.getStatusClass(status)}">${this.getStatusDisplayName(status)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </td>
                <td>${this.formatDate(bug.created_at)}</td>
                <td>
                    <button class="btn btn-danger" onclick="bugTracker.deleteBug('${bug.id}')">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Toggle status dropdown
    toggleStatusDropdown(bugId) {
        console.log('toggleStatusDropdown called with bugId:', bugId);
        
        // Close all other dropdowns first
        document.querySelectorAll('.status-options').forEach(dropdown => {
            if (dropdown.id !== `statusOptions${bugId}`) {
                dropdown.style.display = 'none';
            }
        });

        // Toggle current dropdown
        const dropdown = document.getElementById(`statusOptions${bugId}`);
        if (dropdown) {
            const isVisible = dropdown.style.display !== 'none';
            dropdown.style.display = isVisible ? 'none' : 'block';
            console.log('Dropdown visibility changed to:', dropdown.style.display);
        } else {
            console.error('Dropdown not found for bug:', bugId);
        }
    }

    // Close dropdowns when clicking outside
    closeStatusDropdowns() {
        document.querySelectorAll('.status-options').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }

    async updateBugStatus(bugId, newStatus) {
        console.log('updateBugStatus called with:', bugId, newStatus);
        
        try {
            const response = await fetch(`${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.bugDetail(bugId)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const updatedBug = await response.json();
            console.log('Bug status updated successfully:', updatedBug);
            
            this.showToast(`Bug #${bugId} status updated to ${this.getStatusDisplayName(newStatus)}!`, 'success');
            
            // Close the dropdown
            const dropdown = document.getElementById(`statusOptions${bugId}`);
            if (dropdown) {
                dropdown.style.display = 'none';
            }
            
            // Refresh data
            await this.loadBugsFromAPI();
            this.filterBugs();
            if (this.currentPage === 'stats') {
                await this.updateStatsFromAPI();
            }
            
        } catch (error) {
            console.error('Error updating bug status:', error);
            this.showToast('Error updating bug status: ' + error.message, 'error');
        }
    }

    async toggleStatus(bugId) {
        // Legacy method - kept for backward compatibility
        // Now redirects to the new status dropdown
        this.toggleStatusDropdown(bugId);
    }

    async deleteBug(bugId) {
        const bug = this.bugs.find(b => b.id === bugId);
        if (!bug || !confirm(`Are you sure you want to delete bug #${bugId}: "${bug.title}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.bugDetail(bugId)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.showToast(`Bug #${bugId} has been deleted!`, 'warning');
            
            // Refresh data
            await this.loadBugsFromAPI();
            this.filterBugs();
            if (this.currentPage === 'stats') {
                await this.updateStatsFromAPI();
            }
            
        } catch (error) {
            console.error('Error deleting bug:', error);
            this.showToast('Error deleting bug: ' + error.message, 'error');
        }
    }

    // Load statistics from Django API
    async updateStatsFromAPI() {
        try {
            const response = await fetch(`${this.API_CONFIG.BASE_URL}${this.API_CONFIG.ENDPOINTS.bugStats}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const stats = await response.json();
            this.updateStatsDisplay(stats);
            
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.showToast('Error loading statistics: ' + error.message, 'error');
            // Fallback to local calculation
            this.updateStats();
        }
    }

    updateStatsDisplay(stats) {
        // Update main stat cards from API response
        const elements = {
            totalBugs: document.getElementById('totalBugs'),
            openBugs: document.getElementById('openBugs'),
            closedBugs: document.getElementById('closedBugs'),
            commonSeverity: document.getElementById('commonSeverity')
        };

        if (elements.totalBugs) elements.totalBugs.textContent = stats.total_bugs || 0;
        if (elements.openBugs) elements.openBugs.textContent = stats.open_bugs || 0;
        if (elements.closedBugs) elements.closedBugs.textContent = stats.closed_bugs || 0;
        if (elements.commonSeverity) {
            const severity = stats.most_common_severity;
            elements.commonSeverity.textContent = severity ? 
                severity.charAt(0).toUpperCase() + severity.slice(1) : '-';
        }

        // Update detailed stats if available
        this.updateDetailedStats();
    }

    updateStats() {
        // Fallback method using local data
        const totalBugs = this.bugs.length;
        const openBugs = this.bugs.filter(bug => this.getDisplayStatus(bug) === 'open').length;
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

        this.updateDetailedStats();
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
            new Date(bug.created_at) >= oneWeekAgo
        ).length;

        const resolvedThisWeek = this.bugs.filter(bug => 
            (bug.status === 'resolved' || bug.status === 'closed') && 
            new Date(bug.updated_at || bug.created_at) >= oneWeekAgo
        ).length;

        // Calculate average resolution time
        const resolvedBugs = this.bugs.filter(bug => bug.status === 'resolved' || bug.status === 'closed');
        let avgResolutionTime = 'N/A';
        
        if (resolvedBugs.length > 0) {
            const totalResolutionTime = resolvedBugs.reduce((sum, bug) => {
                const created = new Date(bug.created_at);
                const updated = new Date(bug.updated_at || bug.created_at);
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

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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