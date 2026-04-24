document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const emailTextarea = document.getElementById('emailContent');
    const checkButton = document.getElementById('checkButton');
    const clearButton = document.getElementById('clearButton');
    const resultDiv = document.getElementById('result');
    const charCounter = document.getElementById('charCounter');
    const themeToggle = document.getElementById('themeToggle');
    const realTimeCheckbox = document.getElementById('realTimeCheck');
    const highlightKeywordsCheckbox = document.getElementById('highlightKeywords');
    const detailedAnalysisDiv = document.getElementById('detailedAnalysis');
    const scanHistoryDiv = document.getElementById('scanHistory');
    
    // Firestore setup (from window object initialized in index.html)
    const { db, firestoreActions } = window;
    const { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } = firestoreActions;
    
    // Enhanced Spam keywords with weights
    const spamCategories = {
        urgency: { weight: 1.5, words: ["urgent", "act now", "limited time", "immediate", "asap", "expires", "last chance"] },
        money: { weight: 2.0, words: ["winner", "free", "claim now", "cash prize", "congratulations", "lottery", "million dollars", "earn money", "fast cash", "investment", "inheritance", "nigerian prince", "bank transfer", "loan", "debt"] },
        marketing: { weight: 1.2, words: ["exclusive offer", "discount", "best price", "buy now", "special promotion", "save big", "incredible deal"] },
        suspicious: { weight: 1.8, words: ["click here", "don't delete", "risk-free", "guaranteed", "viagra", "pharmacy", "pills", "miracle cure", "casino", "jackpot"] }
    };
    
    const allSpamKeywords = Object.values(spamCategories).flatMap(cat => cat.words);
    
    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Theme logic
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }
    
    function updateThemeIcon(theme) {
        themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
    
    function toggleTheme() {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }
    
    // Improved Classifier Logic
    function analyzeEmail(email) {
        email = email.toLowerCase();
        let totalScore = 0;
        let matchedKeywords = [];
        let categoryScores = { urgency: 0, money: 0, marketing: 0, suspicious: 0 };
        
        // 1. Keyword Analysis
        for (const [category, data] of Object.entries(spamCategories)) {
            data.words.forEach(word => {
                const regex = new RegExp('\\b' + word + '\\b', 'g');
                const matches = email.match(regex);
                if (matches) {
                    const contribution = matches.length * data.weight;
                    totalScore += contribution;
                    categoryScores[category] += contribution;
                    if (!matchedKeywords.includes(word)) matchedKeywords.push(word);
                }
            });
        }
        
        // 2. Pattern Analysis
        // Excessive punctuation
        const exclamationCount = (email.match(/!/g) || []).length;
        if (exclamationCount > 3) totalScore += 2;
        
        // ALL CAPS words (5+ chars)
        const capsMatches = email.match(/\b[A-Z]{5,}\b/g) || [];
        if (capsMatches.length > 2) totalScore += capsMatches.length * 0.5;
        
        // Too many links (placeholder logic)
        const linkMatches = email.match(/https?:\/\//g) || [];
        if (linkMatches.length > 2) totalScore += linkMatches.length;

        // Normalize score to 0-100 percentage
        const confidence = Math.min(100, Math.round((totalScore / 15) * 100));
        
        return {
            isSpam: confidence > 60,
            confidence: confidence,
            matchedKeywords: matchedKeywords,
            categoryScores: categoryScores,
            patternMatches: exclamationCount + capsMatches.length + linkMatches.length
        };
    }
    
    // Check spam and save to Firestore
    async function checkSpam() {
        const email = emailTextarea.value.trim();
        if (!email) return;
        
        checkButton.disabled = true;
        checkButton.innerHTML = '<span class="spinner"></span>Analyzing...';
        resultDiv.classList.add('hidden');
        detailedAnalysisDiv.classList.add('hidden');
        
        try {
            // Perform improved local analysis
            const data = analyzeEmail(email);
            
            // Save to Firestore
            if (db) {
                try {
                    await addDoc(collection(db, "scans"), {
                        content: email.substring(0, 200), // Only store preview for privacy/storage
                        isSpam: data.isSpam,
                        confidence: data.confidence,
                        timestamp: serverTimestamp()
                    });
                } catch (err) {
                    console.error("Firestore Error:", err);
                }
            }
            
            displayResult(data);
            displayDetailedAnalysis(data);
        } catch (error) {
            console.error('Analysis Error:', error);
            resultDiv.className = 'error';
            resultDiv.innerHTML = `<div class="result-icon"><i class="fas fa-exclamation-triangle"></i></div><p>Error analyzing email.</p>`;
            resultDiv.classList.remove('hidden');
        } finally {
            checkButton.disabled = false;
            checkButton.innerHTML = '<i class="fas fa-search"></i> Check Spam';
        }
    }
    
    const realTimeSpamCheck = debounce(function() {
        if (!realTimeCheckbox.checked || emailTextarea.value.length < 20) return;
        const data = analyzeEmail(emailTextarea.value);
        displayResult(data, true);
    }, 500);
    
    function displayResult(data, isPreliminary = false) {
        let resultClass = data.isSpam ? 'spam' : (data.confidence > 30 ? 'warning' : 'not-spam');
        let resultIcon = data.isSpam ? 'exclamation-circle' : (data.confidence > 30 ? 'exclamation-triangle' : 'check-circle');
        let resultTitle = data.isSpam ? 'Highly Likely Spam' : (data.confidence > 30 ? 'Suspicious Content' : 'Appears Legitimate');
        
        resultDiv.className = resultClass;
        resultDiv.innerHTML = `
            <div class="result-icon"><i class="fas fa-${resultIcon}"></i></div>
            <div class="result-text">
                <p>${resultTitle} (${data.confidence}%)</p>
                ${isPreliminary ? '<p class="small">Click "Check Spam" for detailed report.</p>' : ''}
            </div>
        `;
        resultDiv.classList.remove('hidden');
        
        if (highlightKeywordsCheckbox.checked) highlightKeywords(data.matchedKeywords);
    }
    
    function displayDetailedAnalysis(data) {
        const analysisContent = detailedAnalysisDiv.querySelector('.analysis-content');
        analysisContent.innerHTML = '';
        
        const items = [
            { title: 'Spam Score', value: `${data.confidence}%`, meter: data.confidence },
            { title: 'Keywords', value: data.matchedKeywords.length, meter: Math.min(100, data.matchedKeywords.length * 10) },
            { title: 'Patterns', value: data.patternMatches, meter: Math.min(100, data.patternMatches * 20) }
        ];
        
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'analysis-item';
            el.innerHTML = `<h4>${item.title}</h4><p>${item.value}</p><div class="meter-container"><div class="meter-fill" style="width: 0%"></div></div>`;
            analysisContent.appendChild(el);
            setTimeout(() => el.querySelector('.meter-fill').style.width = `${item.meter}%`, 100);
        });
        
        detailedAnalysisDiv.classList.remove('hidden');
    }
    
    function highlightKeywords(keywords) {
        const existing = document.querySelector('.highlighted-content');
        if (existing) existing.remove();
        if (!keywords.length || !highlightKeywordsCheckbox.checked) return;
        
        const div = document.createElement('div');
        div.className = 'highlighted-content';
        let html = emailTextarea.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        keywords.forEach(word => {
            const regex = new RegExp('\\b(' + word + ')\\b', 'gi');
            html = html.replace(regex, '<span class="highlight">$1</span>');
        });
        
        div.innerHTML = html;
        Object.assign(div.style, {
            position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
            padding: window.getComputedStyle(emailTextarea).padding,
            font: window.getComputedStyle(emailTextarea).font,
            whiteSpace: 'pre-wrap', pointerEvents: 'none', color: 'transparent'
        });
        
        emailTextarea.parentElement.style.position = 'relative';
        emailTextarea.parentElement.appendChild(div);
    }
    
    // Firestore History Listener
    function listenToHistory() {
        if (!db) return;
        const q = query(collection(db, "scans"), orderBy("timestamp", "desc"), limit(10));
        onSnapshot(q, (snapshot) => {
            scanHistoryDiv.innerHTML = '';
            if (snapshot.empty) {
                scanHistoryDiv.innerHTML = '<p class="empty-history">No recent scans.</p>';
                return;
            }
            snapshot.forEach((doc) => {
                const data = doc.data();
                const item = document.createElement('div');
                item.className = 'history-item';
                const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : 'Just now';
                item.innerHTML = `
                    <div class="history-item-header">
                        <span class="history-status ${data.isSpam ? 'spam' : 'not-spam'}">${data.isSpam ? 'Spam' : 'Safe'}</span>
                        <span class="history-date">${date}</span>
                    </div>
                    <p class="history-preview">${data.content}</p>
                `;
                item.onclick = () => { emailTextarea.value = data.content; updateCharacterCount(); };
                scanHistoryDiv.appendChild(item);
            });
        });
    }
    
    function clearText() {
        emailTextarea.value = '';
        updateCharacterCount();
        resultDiv.classList.add('hidden');
        detailedAnalysisDiv.classList.add('hidden');
        const h = document.querySelector('.highlighted-content');
        if (h) h.remove();
    }
    
    function updateCharacterCount() {
        charCounter.textContent = `${emailTextarea.value.length} / 5000`;
        checkButton.disabled = !emailTextarea.value.trim();
    }
    
    // Listeners
    checkButton.addEventListener('click', checkSpam);
    clearButton.addEventListener('click', clearText);
    themeToggle.addEventListener('click', toggleTheme);
    emailTextarea.addEventListener('input', () => { updateCharacterCount(); realTimeSpamCheck(); });
    
    // Init
    initTheme();
    updateCharacterCount();
    listenToHistory();
});