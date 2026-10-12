export type CloudStorageProvider =
  | 'google-drive'
  | 'onedrive'
  | 'dropbox'
  | 'box'
  | 'figma'
  | 'notion'
  | 'generic';

export type CloudResourceType =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'form'
  | 'folder'
  | 'pdf'
  | 'archive'
  | 'image'
  | 'design'
  | 'page'
  | 'file'
  | 'link';

export interface CloudLinkPreview {
  url: string;
  provider: CloudStorageProvider;
  providerName: string;
  title: string;
  resourceType: CloudResourceType;
  resourceTypeLabel: string;
  iconType: 'drive' | 'onedrive' | 'dropbox' | 'box' | 'figma' | 'notion' | 'link';
  domain: string;
  displayUrl: string;
  hint?: string;
}

// Regex to detect HTTP/HTTPS URLs in text
export const URL_REGEX =
  /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*))/gi;

/**
 * Detects all valid HTTP/HTTPS URLs inside a block of text.
 */
export function detectUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // Remove duplicates and trailing punctuation often caught by regex (like ., ,, ), !)
  const cleanedUrls = matches.map((u) => {
    let clean = u;
    while (/[.,;:)\]}>]$/.test(clean)) {
      clean = clean.slice(0, -1);
    }
    return clean;
  });
  return Array.from(new Set(cleanedUrls.filter((u) => Boolean(u) && u.startsWith('http'))));
}

/**
 * Checks if a given hostname or URL matches known cloud storage providers.
 */
export function isCloudStorageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    return (
      host === 'drive.google.com' ||
      host === 'docs.google.com' ||
      host === 'onedrive.live.com' ||
      host === '1drv.ms' ||
      host.endsWith('.sharepoint.com') ||
      host === 'dropbox.com' ||
      host === 'www.dropbox.com' ||
      host === 'dl.dropboxusercontent.com' ||
      host === 'paper.dropbox.com' ||
      host === 'app.box.com' ||
      host.endsWith('.box.com') ||
      host === 'notion.so' ||
      host.endsWith('.notion.site') ||
      host === 'figma.com' ||
      host === 'www.figma.com'
    );
  } catch {
    return false;
  }
}

/**
 * Extracts human-readable filename from a path segment or URL query.
 */
function extractFileNameFromPath(pathname: string): string | null {
  try {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const last = decodeURIComponent(segments[segments.length - 1]);
    if (last && (last.includes('.') || last.includes('_') || last.includes('-'))) {
      return last;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Formats a clean truncated display URL.
 */
function getDisplayUrl(url: URL): string {
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.length > 28 ? `${url.pathname.substring(0, 25)}...` : url.pathname;
  return `${host}${path}`;
}

/**
 * Parses a recognized cloud link (Drive, OneDrive, Dropbox, etc.) into structured preview data.
 */
export function parseCloudLink(urlString: string): CloudLinkPreview | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const rawPath = url.pathname;
  const displayUrl = getDisplayUrl(url);

  // 1. Google Drive & Google Docs suite
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    let resourceType: CloudResourceType = 'file';
    let resourceTypeLabel = 'Arquivo Google Drive';
    let title = 'Arquivo Google Drive';

    if (path.includes('/document/d/')) {
      resourceType = 'document';
      resourceTypeLabel = 'Documento';
      title = 'Documento Google Docs';
    } else if (path.includes('/spreadsheets/d/')) {
      resourceType = 'spreadsheet';
      resourceTypeLabel = 'Planilha';
      title = 'Planilha Google Sheets';
    } else if (path.includes('/presentation/d/')) {
      resourceType = 'presentation';
      resourceTypeLabel = 'Apresentação';
      title = 'Apresentação Google Slides';
    } else if (path.includes('/forms/d/')) {
      resourceType = 'form';
      resourceTypeLabel = 'Formulário';
      title = 'Formulário Google Forms';
    } else if (path.includes('/folders/') || path.includes('/drive/folders/')) {
      resourceType = 'folder';
      resourceTypeLabel = 'Pasta compartilhada';
      title = 'Pasta Google Drive';
    } else if (path.includes('/file/d/')) {
      resourceType = 'file';
      resourceTypeLabel = 'Arquivo na nuvem';
      title = 'Arquivo Google Drive';
    }

    return {
      url: urlString,
      provider: 'google-drive',
      providerName: 'Google Drive',
      title,
      resourceType,
      resourceTypeLabel,
      iconType: 'drive',
      domain: host,
      displayUrl,
      hint: 'Armazenamento Google Workspace • Acesso direto',
    };
  }

  // 2. Microsoft OneDrive & SharePoint
  if (host === 'onedrive.live.com' || host === '1drv.ms' || host.endsWith('.sharepoint.com')) {
    let resourceType: CloudResourceType = 'file';
    let resourceTypeLabel = 'Arquivo OneDrive';
    let title = 'Arquivo Microsoft OneDrive';

    if (host.endsWith('.sharepoint.com')) {
      title = 'Documento Microsoft 365';
      if (path.includes('/:x:/')) {
        resourceType = 'spreadsheet';
        resourceTypeLabel = 'Planilha Excel';
        title = 'Planilha Excel (SharePoint / OneDrive)';
      } else if (path.includes('/:w:/')) {
        resourceType = 'document';
        resourceTypeLabel = 'Documento Word';
        title = 'Documento Word (SharePoint / OneDrive)';
      } else if (path.includes('/:p:/')) {
        resourceType = 'presentation';
        resourceTypeLabel = 'Apresentação PowerPoint';
        title = 'Apresentação PowerPoint (SharePoint / OneDrive)';
      } else if (path.includes('/:f:/')) {
        resourceType = 'folder';
        resourceTypeLabel = 'Pasta compartilhada';
        title = 'Pasta SharePoint / OneDrive';
      } else if (path.includes('/:b:/') || path.includes('/:u:/')) {
        resourceType = 'file';
        resourceTypeLabel = 'Arquivo na nuvem';
      }
    } else if (host === '1drv.ms') {
      title = 'Link de Compartilhamento OneDrive';
      resourceTypeLabel = 'Arquivo compartilhado';
    }

    return {
      url: urlString,
      provider: 'onedrive',
      providerName: 'Microsoft OneDrive',
      title,
      resourceType,
      resourceTypeLabel,
      iconType: 'onedrive',
      domain: host,
      displayUrl,
      hint: 'Armazenamento Microsoft 365 • Acesso direto',
    };
  }

  // 3. Dropbox
  if (
    host === 'dropbox.com' ||
    host === 'www.dropbox.com' ||
    host === 'dl.dropboxusercontent.com' ||
    host === 'paper.dropbox.com'
  ) {
    let resourceType: CloudResourceType = 'file';
    let resourceTypeLabel = 'Arquivo Dropbox';
    let title = 'Arquivo Dropbox';

    const extractedName = extractFileNameFromPath(rawPath);
    if (extractedName && extractedName !== 's' && extractedName !== 'sh' && extractedName !== 'scl') {
      title = extractedName;
      if (/\.(xlsx?|csv)$/i.test(extractedName)) {
        resourceType = 'spreadsheet';
        resourceTypeLabel = 'Planilha';
      } else if (/\.(docx?|odt|txt)$/i.test(extractedName)) {
        resourceType = 'document';
        resourceTypeLabel = 'Documento';
      } else if (/\.(pptx?|key)$/i.test(extractedName)) {
        resourceType = 'presentation';
        resourceTypeLabel = 'Apresentação';
      } else if (/\.pdf$/i.test(extractedName)) {
        resourceType = 'pdf';
        resourceTypeLabel = 'Documento PDF';
      } else if (/\.(zip|rar|7z|tar\.gz)$/i.test(extractedName)) {
        resourceType = 'archive';
        resourceTypeLabel = 'Arquivo Compactado';
      } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(extractedName)) {
        resourceType = 'image';
        resourceTypeLabel = 'Imagem';
      }
    }

    if (host === 'paper.dropbox.com') {
      resourceType = 'document';
      resourceTypeLabel = 'Documento Paper';
      title = 'Documento Dropbox Paper';
    } else if (path.includes('/sh/') || path.includes('/folders/')) {
      resourceType = 'folder';
      resourceTypeLabel = 'Pasta compartilhada';
      title = title === 'Arquivo Dropbox' ? 'Pasta Dropbox' : title;
    }

    return {
      url: urlString,
      provider: 'dropbox',
      providerName: 'Dropbox',
      title,
      resourceType,
      resourceTypeLabel,
      iconType: 'dropbox',
      domain: host,
      displayUrl,
      hint: 'Armazenamento Dropbox • Acesso direto',
    };
  }

  // 4. Box
  if (host === 'app.box.com' || host.endsWith('.box.com')) {
    return {
      url: urlString,
      provider: 'box',
      providerName: 'Box',
      title: 'Arquivo Box',
      resourceType: 'file',
      resourceTypeLabel: 'Arquivo Box',
      iconType: 'box',
      domain: host,
      displayUrl,
      hint: 'Armazenamento Box • Acesso direto',
    };
  }

  // 5. Figma
  if (host === 'figma.com' || host === 'www.figma.com') {
    return {
      url: urlString,
      provider: 'figma',
      providerName: 'Figma',
      title: 'Arquivo de Design Figma',
      resourceType: 'design',
      resourceTypeLabel: 'Design & Prototipagem',
      iconType: 'figma',
      domain: host,
      displayUrl,
      hint: 'Projeto Figma • Visualizar protótipo',
    };
  }

  // 6. Notion
  if (host === 'notion.so' || host.endsWith('.notion.site')) {
    return {
      url: urlString,
      provider: 'notion',
      providerName: 'Notion',
      title: 'Página Notion',
      resourceType: 'page',
      resourceTypeLabel: 'Documentação & Notas',
      iconType: 'notion',
      domain: host,
      displayUrl,
      hint: 'Espaço de trabalho Notion • Acesso online',
    };
  }

  // 7. Generic URL fallback
  return {
    url: urlString,
    provider: 'generic',
    providerName: host,
    title: host,
    resourceType: 'link',
    resourceTypeLabel: 'Link Externo',
    iconType: 'link',
    domain: host,
    displayUrl,
  };
}

/**
 * Extracts and parses all recognized cloud links (or all valid URLs) from text.
 * By default, if cloudOnly is true, only returns links matching cloud providers (Drive, OneDrive, Dropbox, etc.).
 */
export function extractCloudLinks(text: string, cloudOnly = true): CloudLinkPreview[] {
  const urls = detectUrls(text);
  const previews: CloudLinkPreview[] = [];

  for (const u of urls) {
    if (cloudOnly && !isCloudStorageUrl(u)) {
      continue;
    }
    const parsed = parseCloudLink(u);
    if (parsed) {
      previews.push(parsed);
    }
  }

  return previews;
}
