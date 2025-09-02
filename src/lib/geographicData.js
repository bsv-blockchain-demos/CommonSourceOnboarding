/**
 * Geographic data for country, province/state selection
 * and intelligent form field management
 */

// Comprehensive country list with metadata
export const countries = [
  { code: 'AF', name: 'Afghanistan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'AL', name: 'Albania', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'DZ', name: 'Algeria', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'AD', name: 'Andorra', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'AO', name: 'Angola', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'AG', name: 'Antigua and Barbuda', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'AR', name: 'Argentina', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'AM', name: 'Armenia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'AU', name: 'Australia', hasProvinces: true, regionLabel: 'State/Territory', postalLabel: 'Postcode' },
  { code: 'AT', name: 'Austria', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'AZ', name: 'Azerbaijan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BS', name: 'Bahamas', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BH', name: 'Bahrain', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BD', name: 'Bangladesh', hasProvinces: true, regionLabel: 'Division', postalLabel: 'Postal Code' },
  { code: 'BB', name: 'Barbados', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BY', name: 'Belarus', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'BE', name: 'Belgium', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'BZ', name: 'Belize', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BJ', name: 'Benin', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BT', name: 'Bhutan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BO', name: 'Bolivia', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'BA', name: 'Bosnia and Herzegovina', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BW', name: 'Botswana', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BR', name: 'Brazil', hasProvinces: true, regionLabel: 'State', postalLabel: 'CEP' },
  { code: 'BN', name: 'Brunei', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BG', name: 'Bulgaria', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BF', name: 'Burkina Faso', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'BI', name: 'Burundi', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'KH', name: 'Cambodia', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'CM', name: 'Cameroon', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CA', name: 'Canada', hasProvinces: true, regionLabel: 'Province/Territory', postalLabel: 'Postal Code' },
  { code: 'CV', name: 'Cape Verde', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CF', name: 'Central African Republic', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TD', name: 'Chad', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CL', name: 'Chile', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'CN', name: 'China', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'CO', name: 'Colombia', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'KM', name: 'Comoros', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CG', name: 'Congo', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CR', name: 'Costa Rica', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'HR', name: 'Croatia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CU', name: 'Cuba', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'CY', name: 'Cyprus', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CZ', name: 'Czech Republic', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'DK', name: 'Denmark', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'DJ', name: 'Djibouti', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'DM', name: 'Dominica', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'DO', name: 'Dominican Republic', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'EC', name: 'Ecuador', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'EG', name: 'Egypt', hasProvinces: true, regionLabel: 'Governorate', postalLabel: 'Postal Code' },
  { code: 'SV', name: 'El Salvador', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'GQ', name: 'Equatorial Guinea', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'ER', name: 'Eritrea', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'EE', name: 'Estonia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'ET', name: 'Ethiopia', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'FJ', name: 'Fiji', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'FI', name: 'Finland', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'FR', name: 'France', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'GA', name: 'Gabon', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'GM', name: 'Gambia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'GE', name: 'Georgia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'DE', name: 'Germany', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'GH', name: 'Ghana', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'GR', name: 'Greece', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'GD', name: 'Grenada', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'GT', name: 'Guatemala', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'GN', name: 'Guinea', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'GW', name: 'Guinea-Bissau', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'GY', name: 'Guyana', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'HT', name: 'Haiti', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'HN', name: 'Honduras', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'HU', name: 'Hungary', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'IS', name: 'Iceland', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'IN', name: 'India', hasProvinces: true, regionLabel: 'State', postalLabel: 'PIN Code' },
  { code: 'ID', name: 'Indonesia', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'IR', name: 'Iran', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'IQ', name: 'Iraq', hasProvinces: true, regionLabel: 'Governorate', postalLabel: 'Postal Code' },
  { code: 'IE', name: 'Ireland', hasProvinces: false, regionLabel: null, postalLabel: 'Eircode' },
  { code: 'IL', name: 'Israel', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'IT', name: 'Italy', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'JM', name: 'Jamaica', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'JP', name: 'Japan', hasProvinces: true, regionLabel: 'Prefecture', postalLabel: 'Postal Code' },
  { code: 'JO', name: 'Jordan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'KZ', name: 'Kazakhstan', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'KE', name: 'Kenya', hasProvinces: true, regionLabel: 'County', postalLabel: 'Postal Code' },
  { code: 'KI', name: 'Kiribati', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'KP', name: 'North Korea', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'KR', name: 'South Korea', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'KW', name: 'Kuwait', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'KG', name: 'Kyrgyzstan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LA', name: 'Laos', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'LV', name: 'Latvia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LB', name: 'Lebanon', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LS', name: 'Lesotho', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LR', name: 'Liberia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LY', name: 'Libya', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LI', name: 'Liechtenstein', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LT', name: 'Lithuania', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LU', name: 'Luxembourg', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MK', name: 'North Macedonia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MG', name: 'Madagascar', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MW', name: 'Malawi', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MY', name: 'Malaysia', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postcode' },
  { code: 'MV', name: 'Maldives', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'ML', name: 'Mali', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MT', name: 'Malta', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MH', name: 'Marshall Islands', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MR', name: 'Mauritania', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MU', name: 'Mauritius', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MX', name: 'Mexico', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'FM', name: 'Micronesia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MD', name: 'Moldova', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MC', name: 'Monaco', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MN', name: 'Mongolia', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'ME', name: 'Montenegro', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MA', name: 'Morocco', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'MZ', name: 'Mozambique', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'MM', name: 'Myanmar', hasProvinces: true, regionLabel: 'State/Region', postalLabel: 'Postal Code' },
  { code: 'NA', name: 'Namibia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'NR', name: 'Nauru', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'NP', name: 'Nepal', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'NL', name: 'Netherlands', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postcode' },
  { code: 'NZ', name: 'New Zealand', hasProvinces: false, regionLabel: null, postalLabel: 'Postcode' },
  { code: 'NI', name: 'Nicaragua', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'NE', name: 'Niger', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'NG', name: 'Nigeria', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'NO', name: 'Norway', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'OM', name: 'Oman', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'PK', name: 'Pakistan', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'PW', name: 'Palau', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'PA', name: 'Panama', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'PG', name: 'Papua New Guinea', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'PY', name: 'Paraguay', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'PE', name: 'Peru', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'PH', name: 'Philippines', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'PL', name: 'Poland', hasProvinces: true, regionLabel: 'Voivodeship', postalLabel: 'Postal Code' },
  { code: 'PT', name: 'Portugal', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'QA', name: 'Qatar', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'RO', name: 'Romania', hasProvinces: true, regionLabel: 'County', postalLabel: 'Postal Code' },
  { code: 'RU', name: 'Russia', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'RW', name: 'Rwanda', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'KN', name: 'Saint Kitts and Nevis', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'LC', name: 'Saint Lucia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'WS', name: 'Samoa', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SM', name: 'San Marino', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'ST', name: 'Sao Tome and Principe', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SA', name: 'Saudi Arabia', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'SN', name: 'Senegal', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'RS', name: 'Serbia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SC', name: 'Seychelles', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SL', name: 'Sierra Leone', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SG', name: 'Singapore', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SK', name: 'Slovakia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SI', name: 'Slovenia', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SB', name: 'Solomon Islands', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SO', name: 'Somalia', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'ZA', name: 'South Africa', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'SS', name: 'South Sudan', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'ES', name: 'Spain', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'LK', name: 'Sri Lanka', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'SD', name: 'Sudan', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'SR', name: 'Suriname', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'SE', name: 'Sweden', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'CH', name: 'Switzerland', hasProvinces: true, regionLabel: 'Canton', postalLabel: 'Postal Code' },
  { code: 'SY', name: 'Syria', hasProvinces: true, regionLabel: 'Governorate', postalLabel: 'Postal Code' },
  { code: 'TW', name: 'Taiwan', hasProvinces: true, regionLabel: 'County/City', postalLabel: 'Postal Code' },
  { code: 'TJ', name: 'Tajikistan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TZ', name: 'Tanzania', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'TH', name: 'Thailand', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'TL', name: 'Timor-Leste', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TG', name: 'Togo', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TO', name: 'Tonga', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TT', name: 'Trinidad and Tobago', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TN', name: 'Tunisia', hasProvinces: true, regionLabel: 'Governorate', postalLabel: 'Postal Code' },
  { code: 'TR', name: 'Turkey', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'TM', name: 'Turkmenistan', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'TV', name: 'Tuvalu', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'UG', name: 'Uganda', hasProvinces: true, regionLabel: 'District', postalLabel: 'Postal Code' },
  { code: 'UA', name: 'Ukraine', hasProvinces: true, regionLabel: 'Oblast', postalLabel: 'Postal Code' },
  { code: 'AE', name: 'United Arab Emirates', hasProvinces: true, regionLabel: 'Emirate', postalLabel: 'Postal Code' },
  { code: 'GB', name: 'United Kingdom', hasProvinces: false, regionLabel: null, postalLabel: 'Postcode' },
  { code: 'US', name: 'United States', hasProvinces: true, regionLabel: 'State', postalLabel: 'ZIP Code' },
  { code: 'UY', name: 'Uruguay', hasProvinces: true, regionLabel: 'Department', postalLabel: 'Postal Code' },
  { code: 'UZ', name: 'Uzbekistan', hasProvinces: true, regionLabel: 'Region', postalLabel: 'Postal Code' },
  { code: 'VU', name: 'Vanuatu', hasProvinces: false, regionLabel: null, postalLabel: 'Postal Code' },
  { code: 'VE', name: 'Venezuela', hasProvinces: true, regionLabel: 'State', postalLabel: 'Postal Code' },
  { code: 'VN', name: 'Vietnam', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'YE', name: 'Yemen', hasProvinces: true, regionLabel: 'Governorate', postalLabel: 'Postal Code' },
  { code: 'ZM', name: 'Zambia', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' },
  { code: 'ZW', name: 'Zimbabwe', hasProvinces: true, regionLabel: 'Province', postalLabel: 'Postal Code' }
].sort((a, b) => a.name.localeCompare(b.name));

// Province/State data for major countries
export const provinceStateData = {
  // Canada - Provinces and Territories
  'CA': [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'YT', name: 'Yukon' }
  ],
  
  // United States - States
  'US': [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'DC', name: 'District of Columbia' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' }
  ],
  
  // Australia - States and Territories
  'AU': [
    { code: 'NSW', name: 'New South Wales' },
    { code: 'VIC', name: 'Victoria' },
    { code: 'QLD', name: 'Queensland' },
    { code: 'WA', name: 'Western Australia' },
    { code: 'SA', name: 'South Australia' },
    { code: 'TAS', name: 'Tasmania' },
    { code: 'ACT', name: 'Australian Capital Territory' },
    { code: 'NT', name: 'Northern Territory' }
  ],
  
  // India - States and Union Territories
  'IN': [
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'AR', name: 'Arunachal Pradesh' },
    { code: 'AS', name: 'Assam' },
    { code: 'BR', name: 'Bihar' },
    { code: 'CT', name: 'Chhattisgarh' },
    { code: 'GA', name: 'Goa' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'HR', name: 'Haryana' },
    { code: 'HP', name: 'Himachal Pradesh' },
    { code: 'JK', name: 'Jammu and Kashmir' },
    { code: 'JH', name: 'Jharkhand' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'KL', name: 'Kerala' },
    { code: 'MP', name: 'Madhya Pradesh' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'MN', name: 'Manipur' },
    { code: 'ML', name: 'Meghalaya' },
    { code: 'MZ', name: 'Mizoram' },
    { code: 'NL', name: 'Nagaland' },
    { code: 'OR', name: 'Odisha' },
    { code: 'PB', name: 'Punjab' },
    { code: 'RJ', name: 'Rajasthan' },
    { code: 'SK', name: 'Sikkim' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'TG', name: 'Telangana' },
    { code: 'TR', name: 'Tripura' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'UT', name: 'Uttarakhand' },
    { code: 'WB', name: 'West Bengal' },
    { code: 'AN', name: 'Andaman and Nicobar Islands' },
    { code: 'CH', name: 'Chandigarh' },
    { code: 'DN', name: 'Dadra and Nagar Haveli' },
    { code: 'DD', name: 'Daman and Diu' },
    { code: 'DL', name: 'Delhi' },
    { code: 'LA', name: 'Ladakh' },
    { code: 'LD', name: 'Lakshadweep' },
    { code: 'PY', name: 'Puducherry' }
  ],
  
  // Brazil - States
  'BR': [
    { code: 'AC', name: 'Acre' },
    { code: 'AL', name: 'Alagoas' },
    { code: 'AP', name: 'Amapá' },
    { code: 'AM', name: 'Amazonas' },
    { code: 'BA', name: 'Bahia' },
    { code: 'CE', name: 'Ceará' },
    { code: 'DF', name: 'Distrito Federal' },
    { code: 'ES', name: 'Espírito Santo' },
    { code: 'GO', name: 'Goiás' },
    { code: 'MA', name: 'Maranhão' },
    { code: 'MT', name: 'Mato Grosso' },
    { code: 'MS', name: 'Mato Grosso do Sul' },
    { code: 'MG', name: 'Minas Gerais' },
    { code: 'PA', name: 'Pará' },
    { code: 'PB', name: 'Paraíba' },
    { code: 'PR', name: 'Paraná' },
    { code: 'PE', name: 'Pernambuco' },
    { code: 'PI', name: 'Piauí' },
    { code: 'RJ', name: 'Rio de Janeiro' },
    { code: 'RN', name: 'Rio Grande do Norte' },
    { code: 'RS', name: 'Rio Grande do Sul' },
    { code: 'RO', name: 'Rondônia' },
    { code: 'RR', name: 'Roraima' },
    { code: 'SC', name: 'Santa Catarina' },
    { code: 'SP', name: 'São Paulo' },
    { code: 'SE', name: 'Sergipe' },
    { code: 'TO', name: 'Tocantins' }
  ],
  
  // China - Provinces
  'CN': [
    { code: 'AH', name: 'Anhui' },
    { code: 'BJ', name: 'Beijing' },
    { code: 'CQ', name: 'Chongqing' },
    { code: 'FJ', name: 'Fujian' },
    { code: 'GS', name: 'Gansu' },
    { code: 'GD', name: 'Guangdong' },
    { code: 'GX', name: 'Guangxi' },
    { code: 'GZ', name: 'Guizhou' },
    { code: 'HI', name: 'Hainan' },
    { code: 'HE', name: 'Hebei' },
    { code: 'HL', name: 'Heilongjiang' },
    { code: 'HA', name: 'Henan' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'HB', name: 'Hubei' },
    { code: 'HN', name: 'Hunan' },
    { code: 'JS', name: 'Jiangsu' },
    { code: 'JX', name: 'Jiangxi' },
    { code: 'JL', name: 'Jilin' },
    { code: 'LN', name: 'Liaoning' },
    { code: 'MO', name: 'Macau' },
    { code: 'NM', name: 'Inner Mongolia' },
    { code: 'NX', name: 'Ningxia' },
    { code: 'QH', name: 'Qinghai' },
    { code: 'SN', name: 'Shaanxi' },
    { code: 'SD', name: 'Shandong' },
    { code: 'SH', name: 'Shanghai' },
    { code: 'SX', name: 'Shanxi' },
    { code: 'SC', name: 'Sichuan' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TJ', name: 'Tianjin' },
    { code: 'XZ', name: 'Tibet' },
    { code: 'XJ', name: 'Xinjiang' },
    { code: 'YN', name: 'Yunnan' },
    { code: 'ZJ', name: 'Zhejiang' }
  ],
  
  // Mexico - States
  'MX': [
    { code: 'AGU', name: 'Aguascalientes' },
    { code: 'BCN', name: 'Baja California' },
    { code: 'BCS', name: 'Baja California Sur' },
    { code: 'CAM', name: 'Campeche' },
    { code: 'CHP', name: 'Chiapas' },
    { code: 'CHH', name: 'Chihuahua' },
    { code: 'CMX', name: 'Ciudad de México' },
    { code: 'COA', name: 'Coahuila' },
    { code: 'COL', name: 'Colima' },
    { code: 'DUR', name: 'Durango' },
    { code: 'GUA', name: 'Guanajuato' },
    { code: 'GRO', name: 'Guerrero' },
    { code: 'HID', name: 'Hidalgo' },
    { code: 'JAL', name: 'Jalisco' },
    { code: 'MEX', name: 'México' },
    { code: 'MIC', name: 'Michoacán' },
    { code: 'MOR', name: 'Morelos' },
    { code: 'NAY', name: 'Nayarit' },
    { code: 'NLE', name: 'Nuevo León' },
    { code: 'OAX', name: 'Oaxaca' },
    { code: 'PUE', name: 'Puebla' },
    { code: 'QUE', name: 'Querétaro' },
    { code: 'ROO', name: 'Quintana Roo' },
    { code: 'SLP', name: 'San Luis Potosí' },
    { code: 'SIN', name: 'Sinaloa' },
    { code: 'SON', name: 'Sonora' },
    { code: 'TAB', name: 'Tabasco' },
    { code: 'TAM', name: 'Tamaulipas' },
    { code: 'TLA', name: 'Tlaxcala' },
    { code: 'VER', name: 'Veracruz' },
    { code: 'YUC', name: 'Yucatán' },
    { code: 'ZAC', name: 'Zacatecas' }
  ]
};

/**
 * Calculate age from birthdate string
 * @param {string} birthdate - Birthdate in dd/mm/yyyy format
 * @returns {number|null} - Age in years or null if invalid
 */
export function calculateAge(birthdate) {
  try {
    // Parse dd/mm/yyyy format
    const parts = birthdate.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const year = parseInt(parts[2], 10);
    
    // Validate date components
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > new Date().getFullYear()) return null;
    
    const birth = new Date(year, month, day);
    const today = new Date();
    
    // Check if date is valid
    if (birth.getDate() !== day || birth.getMonth() !== month || birth.getFullYear() !== year) {
      return null;
    }
    
    // Check if date is in the future
    if (birth > today) return null;
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    console.error('Error calculating age:', error);
    return null;
  }
}

/**
 * Check if user is over 18 based on birthdate string - for privacy-preserving age verification
 * @param {string} birthdate - Birthdate in dd/mm/yyyy format
 * @returns {boolean|null} - true if over 18, false if under 18, null if invalid birthdate
 */
export function isOver18(birthdate) {
  const age = calculateAge(birthdate);
  if (age === null) return null;
  return age >= 18;
}

/**
 * Format birthdate for display
 * @param {string} birthdate - Raw birthdate string
 * @returns {string} - Formatted as dd/mm/yyyy
 */
export function formatBirthdate(birthdate) {
  if (!birthdate) return '';
  
  // Remove any non-numeric characters except slashes
  const cleaned = birthdate.replace(/[^\d\/]/g, '');
  
  // Remove extra slashes
  const withoutExtraSlashes = cleaned.replace(/\/+/g, '/');
  
  // Get just the numbers
  const numbersOnly = withoutExtraSlashes.replace(/\D/g, '');
  
  // Format as dd/mm/yyyy with automatic slash insertion
  let formatted = '';
  
  if (numbersOnly.length > 0) {
    // First two digits (day)
    formatted = numbersOnly.substring(0, 2);
    
    if (numbersOnly.length > 2) {
      // Add slash after day and next two digits (month)
      formatted += '/' + numbersOnly.substring(2, 4);
      
      if (numbersOnly.length > 4) {
        // Add slash after month and remaining digits (year, max 4)
        formatted += '/' + numbersOnly.substring(4, 8);
      }
    }
  }
  
  return formatted;
}

/**
 * Validate birthdate format
 * @param {string} birthdate - Birthdate string to validate
 * @returns {boolean} - True if valid dd/mm/yyyy format
 */
export function validateBirthdate(birthdate) {
  if (!birthdate) return false;
  
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = birthdate.match(regex);
  
  if (!match) return false;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  // Check ranges
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  
  // Check specific month day limits
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Check for leap year
  if (month === 2 && isLeapYear(year)) {
    monthDays[1] = 29;
  }
  
  return day <= monthDays[month - 1];
}

/**
 * Check if year is a leap year
 * @param {number} year - Year to check
 * @returns {boolean} - True if leap year
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get country by code
 * @param {string} code - ISO country code
 * @returns {Object|null} - Country object or null
 */
export function getCountryByCode(code) {
  return countries.find(c => c.code === code) || null;
}

/**
 * Get provinces/states for a country
 * @param {string} countryCode - ISO country code
 * @returns {Array} - Array of provinces/states or empty array
 */
export function getProvincesForCountry(countryCode) {
  return provinceStateData[countryCode] || [];
}