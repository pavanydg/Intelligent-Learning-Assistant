import * as XLSX from 'xlsx'

/**
 * Export data to Excel file
 */
export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  // Create a new workbook
  const wb = XLSX.utils.book_new()
  
  // Convert data to worksheet
  const ws = XLSX.utils.json_to_sheet(data)
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  
  // Write file
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Export data to CSV file
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return
  
  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Handle values with commas, quotes, or newlines
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ].join('\n')
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export multiple sheets to Excel
 */
export const exportMultipleSheets = (sheets: Array<{ name: string; data: any[] }>, filename: string) => {
  const wb = XLSX.utils.book_new()
  
  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  })
  
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Format date for export
 */
export const formatDateForExport = (date: string | Date): string => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

