// import db from "./db";
// import { usersTable, wishlistsTable, itemsTable, paymentsTable } from "./schema";

// async function seed() {
//   console.log("🌱 Seeding database started...");


//   await db.insert(usersTable).values([
//     {
//       firstName: "Brian",
//       lastName: "Otieno",
//       email: "brian.otieno@student.ku.ac.ke",
//       password: "hashedpassword1",
//       imageUrl: "https://picsum.photos/200/300?random=1",
//       eWallet: "MPesa",
//       amount: "2500.00",
//       phoneNumber: "0712345678",
//       dateOfBirth: "2000-05-12",
//       role: "user",
//       verificationCode: "123456",
//       isVerified: true,
//     },
//     {
//       firstName: "Aisha",
//       lastName: "Hassan",
//       email: "aisha.hassan@uonbi.ac.ke",
//       password: "hashedpassword2",
//       imageUrl: "https://picsum.photos/200/300?random=2",
//       eWallet: "MPesa",
//       amount: "5000.00",
//       phoneNumber: "0798765432",
//       dateOfBirth: "1999-11-23",
//       role: "user",
//       verificationCode: "654321",
//       isVerified: true,
//     },
//     {
//       firstName: "Kevin",
//       lastName: "Mwangi",
//       email: "kevin.mwangi@gmail.com",
//       password: "hashedpassword3",
//       imageUrl: "https://picsum.photos/200/300?random=3",
//       eWallet: "Stripe",
//       amount: "0.00",
//       phoneNumber: "0701234567",
//       dateOfBirth: "2001-03-18",
//       role: "user",
//       verificationCode: "789012",
//       isVerified: false,
//     },
//     {
//       firstName: "Sharon",
//       lastName: "Naliaka",
//       email: "sharon.naliaka@strathmore.edu",
//       password: "hashedpassword4",
//       imageUrl: "https://picsum.photos/200/300?random=4",
//       eWallet: "eWallet",
//       amount: "3200.00",
//       phoneNumber: "0790123456",
//       dateOfBirth: "2002-08-05",
//       role: "user",
//       verificationCode: "345678",
//       isVerified: true,
//     },
//     {
//       firstName: "Mike",
//       lastName: "Karanja",
//       email: "mike.karanja@admin.com",
//       password: "hashedpassword5",
//       imageUrl: "https://picsum.photos/200/300?random=5",
//       eWallet: "MPesa",
//       amount: "10000.00",
//       phoneNumber: "0723456789",
//       dateOfBirth: "1998-01-30",
//       role: "admin",
//       verificationCode: "987654",
//       isVerified: true,
//     },
//   ]);

//   // Insert Wishlists
//   await db.insert(wishlistsTable).values([
//     {
//       userId: 1,
//       name: "Brian's Tech Wishlist",
//       description: "Dream gadgets for campus life",
//       deliveryLocation: "Ruiru, Kiambu",
//     },
//     {
//       userId: 2,
//       name: "Aisha's Fashion Picks",
//       description: "Sneakers & clothes for weekends",
//       deliveryLocation: "South B, Nairobi",
//     },
//     {
//       userId: 3,
//       name: "Kevin’s Gaming Gear",
//       description: "Console and accessories I want",
//       deliveryLocation: "Kasarani, Nairobi",
//     },
//   ]);

//   // Insert Items
//   await db.insert(itemsTable).values([
//     {
//       wishlistId: 1,
//       name: "iPhone 14 Pro Max",
//       description: "256GB, Deep Purple",
//       price: "165000.00",
//       quantity: 1,
//       productStatus: false,
//       imageUrl: "https://example.com/iphone14.jpg",
//     },
//     {
//       wishlistId: 1,
//       name: "MacBook Air M2",
//       description: "13-inch, 8GB RAM, 256GB SSD",
//       price: "175000.00",
//       quantity: 1,
//       productStatus: false,
//       imageUrl: "https://example.com/macbook.jpg",
//     },
//     {
//       wishlistId: 2,
//       name: "Nike Air Force 1",
//       description: "White Sneakers, Size 38",
//       price: "12000.00",
//       quantity: 2,
//       productStatus: false,
//       imageUrl: "https://example.com/airforce1.jpg",
//     },
//     {
//       wishlistId: 2,
//       name: "Zara Denim Jacket",
//       description: "Blue washed, size M",
//       price: "8500.00",
//       quantity: 1,
//       productStatus: false,
//       imageUrl: "https://example.com/zarajacket.jpg",
//     },
//     {
//       wishlistId: 3,
//       name: "PlayStation 5 Console",
//       description: "Standard edition with controller",
//       price: "95000.00",
//       quantity: 1,
//       productStatus: false,
//       imageUrl: "https://example.com/ps5.jpg",
//     },
//   ]);

//   // Insert Payments
//   await db.insert(paymentsTable).values([
//     {
//       itemId: 1,
//       userId: 2, // Aisha contributed to Brian’s wishlist
//       quantityPaid: 1,
//       totalAmount: "165000.00",
//       paymentStatus: "Completed",
//       paymentMethod: "MPesa",
//       transactionID: "MPESA123XYZ",
//     },
//     {
//       itemId: 3,
//       userId: 1, // Brian contributed to Aisha’s wishlist
//       quantityPaid: 1,
//       totalAmount: "12000.00",
//       paymentStatus: "Completed",
//       paymentMethod: "Stripe",
//       transactionID: "STRIPE456ABC",
//     },
//     {
//       itemId: 5,
//       userId: 4, // Sharon helped Kevin
//       quantityPaid: 1,
//       totalAmount: "95000.00",
//       paymentStatus: "Pending",
//       paymentMethod: "eWallet",
//       transactionID: "EWALLET789DEF",
//     },
//   ]);

//   console.log("✅ Seeding completed successfully.");
//   process.exit(0);
// }

// seed().catch((error) => {
//   console.error("❌ Seeding failed:", error);
//   process.exit(1);
// });
