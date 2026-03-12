const User = require('../models/userModel');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

const getDiscoverProfiles = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const currentUser = await User.findByPk(currentUserId);
    if (!currentUser || !currentUser.isProfileComplete) {
      return res.status(403).json({ message: 'Complete your profile to see matches.' });
    }

    const currentLanguages = currentUser.languages || [];
    const currentInterests = currentUser.interests || [];

    // 🔑 Query params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    const search = req.query.search || '';
    const gender = req.query.gender || 'all';
    const ageMin = parseInt(req.query.ageMin) || 18;
    const ageMax = parseInt(req.query.ageMax) || 100;

    const now = new Date();
    const isEffectivelyBanned = currentUser.isBanned &&
      (currentUser.bannedUntil === null || new Date(currentUser.bannedUntil) > now);

    if (isEffectivelyBanned) {
      return res.status(403).json({ message: 'You are banned from discovering users.' });
    }

    // Step 1: Base conditions
    const whereConditions = {
      id: { [Op.ne]: currentUserId },
      isProfileComplete: true,
      deletedAt: null,
    };

    // Step 2: Apply gender filter
    if (gender !== 'all') {
      whereConditions.gender = gender;
    }

    // Step 3: Apply name search (case insensitive)
   if (search.trim() !== '') {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { city: { [Op.iLike]: `%${search.trim()}%` } }
      ];
    }

    // Step 4: Fetch all candidates
    const users = await User.findAll({
      where: whereConditions,
      attributes: [
        'id',
        'name',
        'photo',
        'gender',
        'dateOfBirth',
        'city',
        'bio',
        'interests',
        'languages',
        'isOnline',
        'lastSeen',
      ],
    });

    const baseUrl = `http://${req.get('host')}`;
    const totalPossible = (currentLanguages.length * 2) + currentInterests.length;

    // Step 5: Filter by age
    const today = new Date();
    const filteredUsers = users.filter(user => {
      if (!user.dateOfBirth) return false;

      // Exclude banned users
      const userIsBanned = user.isBanned &&
        (user.bannedUntil === null || new Date(user.bannedUntil) > now);
      if (userIsBanned) return false;

      const dob = new Date(user.dateOfBirth);
      let age = today.getFullYear() - dob.getFullYear();
      if (
        today.getMonth() < dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
      ) {
        age--;
      }
      return age >= ageMin && age <= ageMax;
    });

    // Step 6: Format & add match %
    const formattedUsers = filteredUsers.map(user => {
      const userLanguages = user.languages || [];
      const userInterests = user.interests || [];

      const languageOverlap = userLanguages.filter(lang => currentLanguages.includes(lang));
      const interestOverlap = userInterests.filter(interest => currentInterests.includes(interest));

      const score = (languageOverlap.length * 2) + interestOverlap.length;
      const matchPercentage = totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0;

      return {
        id: user.id,
        name: user.name,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        city: user.city,
        bio: user.bio,
        interests: user.interests || [],
        languages: user.languages || [],
        photo: user.photo ? `${baseUrl}${user.photo}` : null,
        matchPercentage,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      };
    });

    // Step 7: Sorting rules
    formattedUsers.sort((a, b) => {
      const aOnline = a.isOnline ? 1 : 0;
      const bOnline = b.isOnline ? 1 : 0;

      if (aOnline !== bOnline) return bOnline - aOnline;

      if (aOnline === 1 && bOnline === 1) {
        if (a.matchPercentage !== b.matchPercentage) {
          return b.matchPercentage - a.matchPercentage;
        }
        const aLast = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const bLast = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return bLast - aLast;
      }

      if (aOnline === 0 && bOnline === 0) {
        const aLast = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const bLast = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return bLast - aLast;
      }

      return 0;
    });

    // Step 8: Pagination
    const paginatedUsers = formattedUsers.slice(offset, offset + limit);

    res.json({
      users: paginatedUsers,
      hasMore: offset + limit < formattedUsers.length,
      totalCount: formattedUsers.length,
      currentPage: page,
    });

  } catch (error) {
    console.error('Error filtering discover profiles:', error);
    res.status(500).json({ message: 'Failed to fetch matches' });
  }
};

// Upload profile photo
const uploadPhoto = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old photo if exists
    if (user.photo && user.photo !== req.file.filename) {
      const oldPhotoPath = path.join(__dirname, '../../uploads/profiles/', user.photo);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update user with new photo path (store relative path in DB)
    const photoPath = `/uploads/profiles/${req.file.filename}`;
    await user.update({ photo: photoPath });

    // Return full URL for the client
    const baseUrl = `http://${req.get('host')}`;
    const photoUrl = `${baseUrl}${photoPath}`;

    console.log('Photo uploaded successfully:', photoUrl);

    res.json({
      message: 'Photo uploaded successfully',
      photoUrl: photoUrl
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
};

// Update profile information
// const updateProfile = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const {
//       name,
//       gender,
//       email,
//       dateOfBirth,
//       city,
//       bio,
//       interests,
//       languages,
//       phone
//     } = req.body;

//     const user = await User.findByPk(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // ✅ Require at least one of email or phone
//     if (!email && !phone) {
//       return res.status(400).json({ message: 'Either email or phone is required' });
//     }

//     // Check if all required fields are provided
//     const requiredFields = ['name', 'gender', 'dateOfBirth', 'city', 'interests', 'languages'];
//     const hasAllFields = requiredFields.every(
//       field => req.body[field] !== undefined && req.body[field] !== null
//     );

//     // Update user profile
//     const updateData = {
//       name,
//       gender,
//       email: email && email.trim() !== '' ? email.trim() : null,
//       dateOfBirth,
//       city,
//       bio,
//       interests: Array.isArray(interests) ? interests : [],
//       languages: Array.isArray(languages) ? languages : [],
//       phone: phone && phone.trim() !== '' ? phone.trim() : null,
//       isProfileComplete: hasAllFields
//     };

//     await user.update(updateData);

//     // Convert relative photo path to full URL if photo exists
//     let photoUrl = null;
//     if (user.photo) {
//       const baseUrl = `http://${req.get('host')}`;
//       photoUrl = `${baseUrl}${user.photo}`;
//     }

//     res.json({
//       message: 'Profile updated successfully',
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         photo: photoUrl,
//         gender: user.gender,
//         dateOfBirth: user.dateOfBirth,
//         city: user.city,
//         bio: user.bio,
//         interests: user.interests,
//         languages: user.languages,
//         isProfileComplete: user.isProfileComplete
//       }
//     });

//   } catch (error) {
//     console.error('Profile update error:', error);
//     res.status(500).json({ message: 'Failed to update profile' });
//   }
// };

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      gender,
      email,
      dateOfBirth,
      city,
      bio,
      interests,
      languages,
      phone,
      isOnboarding = false // 👈 flag from frontend
    } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Only require email/phone if NOT onboarding
    if (!isOnboarding && !email && !phone) {
      return res.status(400).json({ message: 'Either email or phone is required' });
    }

    // ✅ Required fields for profile completeness
    const requiredFields = ['name', 'gender', 'dateOfBirth', 'city', 'interests', 'languages'];
    const hasAllFields = requiredFields.every(
      field => req.body[field] !== undefined && req.body[field] !== null
    );

    // ✅ Build update object dynamically
    const updateData = {
      name,
      gender,
      dateOfBirth,
      city,
      bio,
      interests: Array.isArray(interests) ? interests : [],
      languages: Array.isArray(languages) ? languages : [],
      isProfileComplete: hasAllFields
    };

    // Only allow email/phone update if NOT onboarding
    if (!isOnboarding) {
      if (email && email.trim() !== '') updateData.email = email.trim();
      if (phone && phone.trim() !== '') updateData.phone = phone.trim();
    }

    await user.update(updateData);

    // Convert photo path to URL
    let photoUrl = null;
    if (user.photo) {
      const baseUrl = `http://${req.get('host')}`;
      photoUrl = `${baseUrl}${user.photo}`;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: photoUrl,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        city: user.city,
        bio: user.bio,
        interests: user.interests,
        languages: user.languages,
        isProfileComplete: user.isProfileComplete
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};


// Get current user's profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const isEffectivelyBanned = user.isBanned &&
      (user.bannedUntil === null || new Date(user.bannedUntil) > now);

    // Convert relative photo path to full URL if photo exists
    let photoUrl = null;
    if (user.photo) {
      const baseUrl = `http://${req.get('host')}`;
      photoUrl = `${baseUrl}${user.photo}`;
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: photoUrl,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        city: user.city,
        bio: user.bio,
        interests: user.interests || [],
        languages: user.languages || [],
        isProfileComplete: user.isProfileComplete,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        isBanned: user.isBanned,
        banReason: user.banReason || null,
        bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
        isEffectivelyBanned // computed flag
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
};

module.exports = {
  uploadPhoto,
  updateProfile,
  getProfile,
  getDiscoverProfiles
}; 