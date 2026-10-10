export function assetUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  
  if (path.startsWith('/uploads') || path.startsWith('/api/private-uploads')) {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return path;
    
    // VITE_API_URL is typically "http://localhost:3001/api"
    const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl.replace(/\/api\/?$/, '');
    return baseUrl + path;
  }
  
  return path;
}

export async function openPrivateDocument(path?: string | null) {
  if (!path) return;
  const url = assetUrl(path);
  
  if (url.startsWith('http') && !url.includes(import.meta.env.VITE_API_URL || '')) {
     window.open(url, '_blank');
     return;
  }

  const token = localStorage.getItem('token');
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch document');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank');
  } catch (err) {
    console.error('Error opening document:', err);
    alert('Failed to open document. It may be restricted.');
  }
}

