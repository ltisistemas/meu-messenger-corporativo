import { describe, it, expect } from 'vitest';
import {
  detectUrls,
  isCloudStorageUrl,
  parseCloudLink,
  extractCloudLinks,
} from '../cloud-links';

describe('Cloud Storage Link Detection & Card Parsing (T-23)', () => {
  describe('detectUrls', () => {
    it('extracts single and multiple URLs from text', () => {
      const text =
        'Segue a planilha: https://docs.google.com/spreadsheets/d/12345/edit e também o relatório https://www.dropbox.com/s/xyz/doc.pdf!';
      const urls = detectUrls(text);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe('https://docs.google.com/spreadsheets/d/12345/edit');
      expect(urls[1]).toBe('https://www.dropbox.com/s/xyz/doc.pdf');
    });

    it('strips trailing punctuation like commas, periods, brackets', () => {
      const text =
        '(veja em https://drive.google.com/file/d/abc123/view), e confira https://onedrive.live.com/view.aspx?resid=999.';
      const urls = detectUrls(text);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe('https://drive.google.com/file/d/abc123/view');
      expect(urls[1]).toBe('https://onedrive.live.com/view.aspx?resid=999');
    });

    it('returns empty array when text has no URLs or is empty', () => {
      expect(detectUrls('')).toEqual([]);
      expect(detectUrls('Olá, bom dia! Como vai?')).toEqual([]);
    });

    it('deduplicates identical URLs in the same message', () => {
      const text =
        'Link: https://drive.google.com/file/d/123 e de novo https://drive.google.com/file/d/123';
      const urls = detectUrls(text);
      expect(urls).toHaveLength(1);
    });
  });

  describe('isCloudStorageUrl', () => {
    it('identifies Google Drive and Google Docs domains', () => {
      expect(isCloudStorageUrl('https://drive.google.com/file/d/123/view')).toBe(true);
      expect(isCloudStorageUrl('https://docs.google.com/document/d/123/edit')).toBe(true);
      expect(isCloudStorageUrl('https://docs.google.com/spreadsheets/d/123/edit')).toBe(true);
    });

    it('identifies Microsoft OneDrive and SharePoint domains', () => {
      expect(isCloudStorageUrl('https://onedrive.live.com/?id=root')).toBe(true);
      expect(isCloudStorageUrl('https://1drv.ms/u/s!AlmXyZ')).toBe(true);
      expect(isCloudStorageUrl('https://mycompany.sharepoint.com/:x:/g/personal/doc.xlsx')).toBe(
        true
      );
    });

    it('identifies Dropbox domains', () => {
      expect(isCloudStorageUrl('https://dropbox.com/s/xyz/file.zip')).toBe(true);
      expect(isCloudStorageUrl('https://www.dropbox.com/scl/fi/xyz/table.csv?dl=0')).toBe(true);
      expect(isCloudStorageUrl('https://dl.dropboxusercontent.com/s/xyz/test.pdf')).toBe(true);
      expect(isCloudStorageUrl('https://paper.dropbox.com/doc/abc')).toBe(true);
    });

    it('identifies Box, Figma, and Notion domains', () => {
      expect(isCloudStorageUrl('https://app.box.com/s/123456')).toBe(true);
      expect(isCloudStorageUrl('https://figma.com/file/abcdef/UI-Kit')).toBe(true);
      expect(isCloudStorageUrl('https://notion.so/myworkspace/Docs-123')).toBe(true);
    });

    it('returns false for non-cloud domains or invalid URLs', () => {
      expect(isCloudStorageUrl('https://google.com')).toBe(false);
      expect(isCloudStorageUrl('https://github.com/repo')).toBe(false);
      expect(isCloudStorageUrl('invalid-url')).toBe(false);
    });
  });

  describe('parseCloudLink', () => {
    it('parses Google Docs document link', () => {
      const parsed = parseCloudLink('https://docs.google.com/document/d/1A2B3C4D5E6F/edit');
      expect(parsed).not.toBeNull();
      expect(parsed?.provider).toBe('google-drive');
      expect(parsed?.providerName).toBe('Google Drive');
      expect(parsed?.resourceType).toBe('document');
      expect(parsed?.resourceTypeLabel).toBe('Documento');
      expect(parsed?.iconType).toBe('drive');
      expect(parsed?.title).toBe('Documento Google Docs');
    });

    it('parses Google Sheets spreadsheet link', () => {
      const parsed = parseCloudLink('https://docs.google.com/spreadsheets/d/1A2B3C/edit#gid=0');
      expect(parsed?.provider).toBe('google-drive');
      expect(parsed?.resourceType).toBe('spreadsheet');
      expect(parsed?.title).toBe('Planilha Google Sheets');
    });

    it('parses Google Slides presentation link', () => {
      const parsed = parseCloudLink('https://docs.google.com/presentation/d/1A2B3C/edit');
      expect(parsed?.resourceType).toBe('presentation');
      expect(parsed?.title).toBe('Apresentação Google Slides');
    });

    it('parses Google Drive folder link', () => {
      const parsed = parseCloudLink('https://drive.google.com/drive/folders/1A2B3C');
      expect(parsed?.resourceType).toBe('folder');
      expect(parsed?.title).toBe('Pasta Google Drive');
    });

    it('parses OneDrive and SharePoint links', () => {
      const oneDriveParsed = parseCloudLink('https://1drv.ms/u/s!A12345');
      expect(oneDriveParsed?.provider).toBe('onedrive');
      expect(oneDriveParsed?.providerName).toBe('Microsoft OneDrive');
      expect(oneDriveParsed?.iconType).toBe('onedrive');

      const spParsed = parseCloudLink('https://corp.sharepoint.com/:x:/g/personal/Relatorio.xlsx');
      expect(spParsed?.provider).toBe('onedrive');
      expect(spParsed?.resourceType).toBe('spreadsheet');
      expect(spParsed?.resourceTypeLabel).toBe('Planilha Excel');
    });

    it('parses Dropbox links with filename and file extension detection', () => {
      const parsed = parseCloudLink('https://www.dropbox.com/s/12345/Apresentacao_Final.pptx?dl=0');
      expect(parsed?.provider).toBe('dropbox');
      expect(parsed?.providerName).toBe('Dropbox');
      expect(parsed?.title).toBe('Apresentacao_Final.pptx');
      expect(parsed?.resourceType).toBe('presentation');
      expect(parsed?.iconType).toBe('dropbox');

      const pdfParsed = parseCloudLink(
        'https://www.dropbox.com/scl/fi/abc/Contrato_Assinado.pdf?dl=0'
      );
      expect(pdfParsed?.title).toBe('Contrato_Assinado.pdf');
      expect(pdfParsed?.resourceType).toBe('pdf');
      expect(pdfParsed?.resourceTypeLabel).toBe('Documento PDF');
    });
  });

  describe('extractCloudLinks', () => {
    it('extracts and parses cloud links from full text message', () => {
      const text = `
        Olá time, como o arquivo passa de 25 MB, aqui estão os links:
        - Drive: https://docs.google.com/document/d/1111/edit
        - OneDrive: https://1drv.ms/u/s!2222
        - Dropbox: https://www.dropbox.com/s/3333/Planilha_Precos.xlsx?dl=0
        - Link Comum: https://example.com/site
      `;

      const cloudLinks = extractCloudLinks(text, true);
      expect(cloudLinks).toHaveLength(3);
      expect(cloudLinks.map((l) => l.provider)).toEqual(['google-drive', 'onedrive', 'dropbox']);
      expect(cloudLinks.find((l) => l.provider === 'dropbox')?.title).toBe('Planilha_Precos.xlsx');
    });

    it('extracts all links including generic when cloudOnly is false', () => {
      const text = 'Ver https://example.com/news e https://drive.google.com/file/d/123/view';
      const allLinks = extractCloudLinks(text, false);
      expect(allLinks).toHaveLength(2);
      expect(allLinks[0].provider).toBe('generic');
      expect(allLinks[1].provider).toBe('google-drive');
    });
  });
});

