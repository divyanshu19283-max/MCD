export type MCDSubcategory = {
  id: number;
  code: number;
  name: string;
  categoryId: number;
  channelIds: number[];
};

export type MCDCategory = {
  id: number;
  name: string;
  nameHi?: string | null;
  subcategories: MCDSubcategory[];
};

export const MCD_CATEGORIES: MCDCategory[] = [
  {
    id: 1077, name: "Engineering Building", subcategories: [
      { id: 5469, code: 328, name: "Un- Authorised Construction", categoryId: 1077, channelIds: [245] },
      { id: 5472, code: 331, name: "Dangerous Building", categoryId: 1077, channelIds: [245] },
    ],
  },
  {
    id: 1080, name: "Electrical", subcategories: [
      { id: 5479, code: 338, name: "Request for New Tube Light in Community Center/Hospital/School", categoryId: 1080, channelIds: [245] },
      { id: 5480, code: 339, name: "Request for new Fan’s in MCD School", categoryId: 1080, channelIds: [245] },
      { id: 5481, code: 340, name: "Request for New Fan in MCD Hospital/School/Community Center", categoryId: 1080, channelIds: [245] },
      { id: 5482, code: 341, name: "Request for Repair of Electrical Points in MCD Hospital/School/Community Center", categoryId: 1080, channelIds: [245] },
      { id: 5484, code: 345, name: "Request for New High Mast/Street Lights", categoryId: 1080, channelIds: [245] },
      { id: 5488, code: 350, name: "High Mast /Street Lights not Working", categoryId: 1080, channelIds: [245] },
    ],
  },
  {
    id: 1081, name: "Engineering Works", subcategories: [
      { id: 5471, code: 330, name: "Encroachment on Roads/ Footpath/ Municipal Land", categoryId: 1081, channelIds: [245] },
      { id: 5494, code: 356, name: "Request for Repair of Speed Breaker", categoryId: 1081, channelIds: [245, 252] },
      { id: 5496, code: 358, name: "Request for Repairs/Re-Surfacing of Roads/Footpaths", categoryId: 1081, channelIds: [245, 252] },
      { id: 5498, code: 360, name: "Request for Covering of Drain", categoryId: 1081, channelIds: [245, 252] },
      { id: 5503, code: 365, name: "Rising of Manhole Cover/Grating upto Road Level", categoryId: 1081, channelIds: [245, 252] },
      { id: 5510, code: 372, name: "Request for Removal of Silt from Road", categoryId: 1081, channelIds: [245, 252] },
      { id: 5512, code: 374, name: "Request Repair to Damaged Open Storm Water Drain", categoryId: 1081, channelIds: [245, 252] },
      { id: 5523, code: 385, name: "Request for Removal Malba/Debris", categoryId: 1081, channelIds: [245, 252] },
      { id: 6979, code: 845, name: "Request for Replacement of Damaged/Missing Manhole Cover/Slab/Grating", categoryId: 1081, channelIds: [245, 252] },
    ],
  },
  {
    id: 1082, name: "Horticulture", subcategories: [
      { id: 5501, code: 363, name: "Cutting of Grass", categoryId: 1082, channelIds: [245, 252] },
      { id: 5528, code: 391, name: "Watering Of Plants.", categoryId: 1082, channelIds: [245, 252] },
      { id: 5538, code: 405, name: "Park Booking", categoryId: 1082, channelIds: [245, 252] },
      { id: 5540, code: 407, name: "Park is not Cleaned", categoryId: 1082, channelIds: [245, 252] },
      { id: 5543, code: 410, name: "Maintenance of Grill/Gate/Boundary Wall/Pathway in Park", categoryId: 1082, channelIds: [245, 252] },
      { id: 5546, code: 413, name: "Request for Repair of Tub-Well in Park", categoryId: 1082, channelIds: [245, 252] },
      { id: 5556, code: 424, name: "Request for Trimming/Pruning of Branches/Trees", categoryId: 1082, channelIds: [245, 252] },
      { id: 5562, code: 430, name: "Removal of Dead/Fallen Tree", categoryId: 1082, channelIds: [245, 252] },
      { id: 5661, code: 532, name: "Encroachment in Park", categoryId: 1082, channelIds: [252] },
    ],
  },
  {
    id: 1083, name: "Parking Cell", subcategories: [
      { id: 5531, code: 394, name: "Overchanging in Authorised Parking", categoryId: 1083, channelIds: [245, 252] },
      { id: 5536, code: 402, name: "Parking Staff are not in Uniform", categoryId: 1083, channelIds: [245, 252] },
      { id: 5537, code: 403, name: "Parking Area not Maintained Properly", categoryId: 1083, channelIds: [245, 252] },
      { id: 6978, code: 888, name: "Unauthorised/illegal Parking", categoryId: 1083, channelIds: [245, 252] },
    ],
  },
  {
    id: 1084, name: "Veterinary", subcategories: [
      { id: 5544, code: 411, name: "Catching of Stray/Street Dogs", categoryId: 1084, channelIds: [245, 252] },
      { id: 5548, code: 415, name: "Injured / Sick Animal", categoryId: 1084, channelIds: [245, 252] },
      { id: 5550, code: 417, name: "illegal Meat Shop", categoryId: 1084, channelIds: [245, 252] },
      { id: 5552, code: 419, name: "Removal of Dead Animal", categoryId: 1084, channelIds: [245, 252] },
      { id: 5554, code: 421, name: "illegal Dairy", categoryId: 1084, channelIds: [245, 252] },
      { id: 5560, code: 428, name: "Stray Monkeys", categoryId: 1084, channelIds: [245, 252] },
      { id: 5563, code: 431, name: "Flies Menace", categoryId: 1084, channelIds: [245, 252] },
      { id: 5573, code: 442, name: "Slaughter House/illegal Slaughtering", categoryId: 1084, channelIds: [245, 252] },
      { id: 5574, code: 444, name: "Stray Cattle/Cow/Pig/Others", categoryId: 1084, channelIds: [245, 252] },
    ],
  },
  {
    id: 1085, name: "Property Tax", subcategories: [
      { id: 5671, code: 542, name: "Property Tax Related Issue", categoryId: 1085, channelIds: [245] },
      { id: 9776, code: 1500, name: "UPIC Transfer", categoryId: 1085, channelIds: [245] },
      { id: 9777, code: 1501, name: "Payment Related issue", categoryId: 1085, channelIds: [245] },
      { id: 9778, code: 1502, name: "General Issue", categoryId: 1085, channelIds: [245] },
    ],
  },
  {
    id: 1086, name: "Factory License", subcategories: [
      { id: 5568, code: 436, name: "Report Illegal Factory", categoryId: 1086, channelIds: [252] },
      { id: 5569, code: 437, name: "Factory License Related Issue", categoryId: 1086, channelIds: [252] },
      { id: 5570, code: 438, name: "Dumping of Factory Waste", categoryId: 1086, channelIds: [252] },
    ],
  },
  {
    id: 1087, name: "General Branch", subcategories: [
      { id: 5575, code: 445, name: "Encroachment on Road by Vehicle", categoryId: 1087, channelIds: [245, 252] },
      { id: 5576, code: 446, name: "Illegal Redhi-Patri/Tehbazari", categoryId: 1087, channelIds: [245, 252] },
      { id: 5577, code: 447, name: "Unauthorised Roadside Parking", categoryId: 1087, channelIds: [245, 252] },
      { id: 5580, code: 450, name: "Any Others illegality", categoryId: 1087, channelIds: [245, 252] },
      { id: 5581, code: 451, name: "End of Life Vehicle/Condemned Vehicle on Road", categoryId: 1087, channelIds: [245, 252] },
    ],
  },
  {
    id: 1089, name: "Public Health", subcategories: [
      { id: 5521, code: 383, name: "illegal Food Hawker", categoryId: 1089, channelIds: [245, 252] },
      { id: 5525, code: 388, name: "Spray (Fogging Operation)", categoryId: 1089, channelIds: [252] },
      { id: 5526, code: 389, name: "Malaria patient", categoryId: 1089, channelIds: [252] },
      { id: 5527, code: 390, name: "Encroachment by Eateries", categoryId: 1089, channelIds: [245, 252] },
      { id: 5549, code: 416, name: "Complaints regarding Quality of Food in Hotels", categoryId: 1089, channelIds: [252] },
      { id: 5553, code: 420, name: "Complaints regarding Unauthorized Restaurants", categoryId: 1089, channelIds: [245, 252] },
      { id: 5564, code: 432, name: "Illegal Slaughtering", categoryId: 1089, channelIds: [245, 252] },
      { id: 5571, code: 440, name: "Road Side Eateries", categoryId: 1089, channelIds: [245, 252] },
      { id: 5572, code: 441, name: "Public Health/Dengue/Malaria", categoryId: 1089, channelIds: [252] },
      { id: 5579, code: 449, name: "Unauthorised Sale of Meat and Meat Products", categoryId: 1089, channelIds: [245, 252] },
      { id: 5582, code: 452, name: "Improper Transport of Meat and Livestock", categoryId: 1089, channelIds: [245, 252] },
      { id: 5585, code: 455, name: "Mosquito Menace", categoryId: 1089, channelIds: [252] },
      { id: 5590, code: 460, name: "illegal GYM", categoryId: 1089, channelIds: [245, 252] },
      { id: 5592, code: 462, name: "illegal Dumping of Medical Waste", categoryId: 1089, channelIds: [245, 252] },
    ],
  },
  {
    id: 1090, name: "Cleanliness (Swachhta)", subcategories: [
      { id: 5602, code: 472, name: "Dead Animals", categoryId: 1090, channelIds: [245] },
      { id: 5603, code: 473, name: "Dustbins Not Cleaned", categoryId: 1090, channelIds: [245] },
      { id: 5604, code: 474, name: "Garbage Dumps", categoryId: 1090, channelIds: [245] },
      { id: 5605, code: 475, name: "Public Toilet Blockage", categoryId: 1090, channelIds: [245] },
      { id: 5606, code: 476, name: "Sweeping Not Done", categoryId: 1090, channelIds: [245] },
      { id: 5607, code: 477, name: "No Electricity In Public Toilets", categoryId: 1090, channelIds: [245] },
      { id: 5608, code: 478, name: "No Water Supply In Public Toilets", categoryId: 1090, channelIds: [245] },
      { id: 5609, code: 479, name: "Public Toilet(s) Cleaning", categoryId: 1090, channelIds: [245] },
      { id: 5610, code: 480, name: "Dead Animals/Dog", categoryId: 1090, channelIds: [252] },
      { id: 5611, code: 481, name: "Garbage Vehicle Not Arrived", categoryId: 1090, channelIds: [245] },
      { id: 5612, code: 482, name: "Open Manholes Or Drains", categoryId: 1090, channelIds: [245] },
      { id: 5613, code: 483, name: "Sewerage or Storm Water Overflow", categoryId: 1090, channelIds: [245] },
      { id: 5614, code: 484, name: "Stagnant Water On The Road", categoryId: 1090, channelIds: [245] },
      { id: 5615, code: 485, name: "Improper Disposal of FecalWaste/Septage", categoryId: 1090, channelIds: [245] },
      { id: 5616, code: 486, name: "Debris Removal/Construction Material", categoryId: 1090, channelIds: [245] },
      { id: 5617, code: 487, name: "Burning Of Garbage In Open Space", categoryId: 1090, channelIds: [245] },
      { id: 5618, code: 488, name: "Urination in Public/Open Defecation", categoryId: 1090, channelIds: [245] },
      { id: 5705, code: 577, name: "Non-Sanitary Condition", categoryId: 1090, channelIds: [245, 252] },
      { id: 9635, code: 890, name: "Toilet Door locked", categoryId: 1090, channelIds: [245] },
    ],
  },
  {
    id: 1096, name: "Advertisement", subcategories: [
      { id: 5663, code: 534, name: "Any Other illegality", categoryId: 1096, channelIds: [248, 252] },
      { id: 6973, code: 778, name: "illegal Hoarding", categoryId: 1096, channelIds: [245, 252] },
      { id: 6974, code: 779, name: "illegal Unipole", categoryId: 1096, channelIds: [245, 252] },
      { id: 6975, code: 801, name: "Dangerous Hoarding", categoryId: 1096, channelIds: [245, 252] },
      { id: 6976, code: 802, name: "Dangerous Unipole", categoryId: 1096, channelIds: [245, 252] },
      { id: 6977, code: 803, name: "illegal Banner", categoryId: 1096, channelIds: [245, 252] },
    ],
  },
  {
    id: 1097, name: "Birth and Death", subcategories: [
      { id: 9716, code: 892, name: "Regarding Birth & Death Certificate", categoryId: 1097, channelIds: [252] },
    ],
  },
  {
    id: 1098, name: "Community Service Department", subcategories: [
      { id: 5662, code: 533, name: "Community Centre Booking Complaint", categoryId: 1098, channelIds: [252] },
      { id: 6972, code: 777, name: "Refund Problem", categoryId: 1098, channelIds: [252, 245] },
    ],
  },
  {
    id: 1099, name: "Education", subcategories: [
      { id: 5666, code: 537, name: "Denying Admission", categoryId: 1099, channelIds: [245] },
      { id: 6971, code: 222, name: "Midday Meal Problem", categoryId: 1099, channelIds: [252, 245] },
      { id: 9756, code: 2200, name: "Any Others issue", categoryId: 1099, channelIds: [245, 252] },
    ],
  },
  {
    id: 1103, name: "Information Technology Department", nameHi: "IT", subcategories: [
      { id: 5672, code: 543, name: "Factory License", categoryId: 1103, channelIds: [245] },
      { id: 5674, code: 545, name: "Community Service Department", categoryId: 1103, channelIds: [245] },
      { id: 5676, code: 547, name: "Conversion Parking/ Cell Tower", categoryId: 1103, channelIds: [245] },
      { id: 5677, code: 548, name: "Veternary Trade License", categoryId: 1103, channelIds: [245] },
      { id: 5678, code: 549, name: "LMS For Education Dept, Hawking, School Infra Inventory Repository Application & Hardware Support of All Big Hospitals", categoryId: 1103, channelIds: [245] },
      { id: 5683, code: 554, name: "Health Trade License", categoryId: 1103, channelIds: [245] },
      { id: 5684, code: 555, name: "Issue Regarding Birth & Death Certificate", categoryId: 1103, channelIds: [245] },
      { id: 5686, code: 557, name: "Community Hall Booking & Tahbazari", categoryId: 1103, channelIds: [245] },
      { id: 5695, code: 566, name: "Aadhar Enrolmrnt Centre At Civic Centre.", categoryId: 1103, channelIds: [245] },
      { id: 5696, code: 567, name: "Stationery & Imprest/ Contingency", categoryId: 1103, channelIds: [245] },
      { id: 5702, code: 574, name: "General Trade License", categoryId: 1103, channelIds: [245] },
    ],
  },
  {
    id: 1106, name: "Toll Tax", subcategories: [
      { id: 5710, code: 582, name: "Tag Recharge Issue or Other Tag Related Issue", categoryId: 1106, channelIds: [245, 252, 247] },
      { id: 5711, code: 583, name: "Wrong Deduction From RFID Tag", categoryId: 1106, channelIds: [245, 252, 247] },
      { id: 5712, code: 584, name: "Environment Compensation Charge (ECC) Refund Issue", categoryId: 1106, channelIds: [245, 247, 252] },
      { id: 5713, code: 585, name: "Toll Collection Staff Behavior Issue", categoryId: 1106, channelIds: [245, 252, 247] },
      { id: 6970, code: 123, name: "Overcharge Toll Fee", categoryId: 1106, channelIds: [245, 252] },
    ],
  },
];

export const MCD_CATEGORY_BY_NAME = new Map(MCD_CATEGORIES.map((category) => [category.name, category]));

export function getMcdCategory(name: string | null | undefined) {
  return name ? MCD_CATEGORY_BY_NAME.get(name) ?? null : null;
}
