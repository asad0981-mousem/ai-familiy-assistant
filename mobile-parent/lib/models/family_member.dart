/// دقیقاً مطابق پاسخ GET /api/v1/family-members در
/// backend/src/modules/users/users.controller.ts
class FamilyMember {
  final String id;
  final String displayName;
  final String role; // "parent" | "child"
  final String? ageBand;

  FamilyMember({
    required this.id,
    required this.displayName,
    required this.role,
    this.ageBand,
  });

  bool get isChild => role == 'child';

  factory FamilyMember.fromJson(Map<String, dynamic> json) {
    return FamilyMember(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      role: json['role'] as String,
      ageBand: json['ageBand'] as String?,
    );
  }
}
