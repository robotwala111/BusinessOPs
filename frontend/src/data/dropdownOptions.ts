export const countryOptions = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "Malaysia",
  "Sri Lanka"
];

export const indiaStateOptions = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

export const indiaCityOptions = [
  "Ahmedabad",
  "Bengaluru",
  "Bhopal",
  "Bhubaneswar",
  "Chandigarh",
  "Chennai",
  "Coimbatore",
  "Delhi",
  "Ernakulam",
  "Gurugram",
  "Hyderabad",
  "Indore",
  "Jaipur",
  "Kanchipuram",
  "Karimnagar",
  "Karnal",
  "Karur",
  "Kochi",
  "Kolkata",
  "Kozhikode",
  "Lucknow",
  "Madurai",
  "Mangaluru",
  "Mumbai",
  "Mysuru",
  "Nagpur",
  "Noida",
  "Patna",
  "Pune",
  "Salem",
  "Surat",
  "Thiruvananthapuram",
  "Thrissur",
  "Tiruchirappalli",
  "Tiruppur",
  "Vadodara",
  "Visakhapatnam"
];

export const industryOptions = [
  "E-commerce",
  "Retail",
  "Manufacturing",
  "Healthcare",
  "Education",
  "Real Estate",
  "Hospitality",
  "Fashion and Apparel",
  "Professional Services",
  "Logistics",
  "Finance",
  "Nonprofit",
  "Technology",
  "Food and Beverage"
];

export const leadSourceOptions = [
  "Referral",
  "Website",
  "Google Search",
  "LinkedIn",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Email Campaign",
  "Existing Client",
  "Cold Outreach",
  "Networking Event"
];

export const projectTypeOptions = [
  "Website Development",
  "E-commerce Website",
  "Web Application",
  "Mobile Application",
  "Inventory Management System",
  "CRM",
  "ERP",
  "Automation",
  "SEO and Marketing",
  "Maintenance and Support",
  "Cloud Setup",
  "UI/UX Design",
  "Consulting"
];

export const paymentModeOptions = [
  "Bank Transfer",
  "UPI",
  "Cheque",
  "Cash",
  "Credit Card",
  "Debit Card",
  "Payment Gateway",
  "International Wire",
  "Wallet"
];

export const maintenancePlanOptions = [
  "Basic Maintenance",
  "Standard Maintenance",
  "Premium Maintenance",
  "Enterprise Support",
  "Hourly Support",
  "Yearly AMC"
];

export function getStateOptions(country: string) {
  return country.trim().toLowerCase() === "india" ? indiaStateOptions : [];
}

export function getCityOptions(country: string) {
  return country.trim().toLowerCase() === "india" ? indiaCityOptions : [];
}
