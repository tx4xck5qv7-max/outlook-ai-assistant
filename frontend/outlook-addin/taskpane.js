const BACKEND_URL = "https://cuddly-areas-grin.loca.lt/analyze-email";

Office.onReady((info) => {
    if (info.host === Office.HostType.Outlook) {
        document.getElementById('analyzeBtn').onclick = analyzeEmail;
    }
});

async function analyzeEmail() {
    const btn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');
    
    btn.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';
    error.style.display = 'none';
    
    try {
        const emailContent = await getEmailContent();
        
        if (!emailContent || emailContent.trim().length === 0) {
            throw new Error('Email body is empty');
        }
        
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailContent }),
        });
        
        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.summary || !data.suggestions) {
            throw new Error('Invalid response format');
        }
        
        document.getElementById('summary').textContent = data.summary;
        const suggestionsList = document.getElementById('suggestions');
        suggestionsList.innerHTML = '';
        data.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            suggestionsList.appendChild(li);
        });
        
        results.style.display = 'block';
        
    } catch (err) {
        console.error('Error:', err);
        error.textContent = `Error: ${err.message}`;
        error.style.display = 'block';
    } finally {
        btn.disabled = false;
        loading.style.display = 'none';
    }
}

function getEmailContent() {
    return new Promise((resolve, reject) => {
        try {
            Office.context.mailbox.item.body.getAsync(
                Office.CoercionType.Text,
                (result) => {
                    if (result.status === Office.AsyncResultStatus.Succeeded) {
                        resolve(result.value);
                    } else {
                        reject(new Error('Failed to get email body'));
                    }
                }
            );
        } catch (err) {
            reject(err);
        }
    });
}
