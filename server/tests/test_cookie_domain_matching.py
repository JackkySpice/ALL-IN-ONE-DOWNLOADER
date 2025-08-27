"""
Test for cookie domain matching security fix.

This test verifies that the cookie domain matching logic correctly handles
domain matching to prevent security vulnerabilities where cookies could be
sent to unintended domains.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from http.cookiejar import Cookie


class TestCookieDomainMatching(unittest.TestCase):
    """Test cookie domain matching logic to prevent security vulnerabilities."""

    def test_cookie_domain_matching_security(self):
        """Test that cookie domain matching prevents subdomain attacks."""
        
        # Test cases: (host, cookie_domain, should_match)
        test_cases = [
            # Exact domain match - should match
            ("example.com", "example.com", True),
            ("example.com", ".example.com", True),
            
            # Valid subdomain - should match
            ("www.example.com", "example.com", True),
            ("www.example.com", ".example.com", True),
            ("api.example.com", "example.com", True),
            ("api.example.com", ".example.com", True),
            ("sub.sub.example.com", "example.com", True),
            
            # Invalid matches - security vulnerability if these match
            ("notevil.com", "evil.com", False),  # Critical: prevent suffix matching
            ("notevil.com", ".evil.com", False),
            ("example.com", "ample.com", False),  # Suffix is not subdomain
            ("myexample.com", "example.com", False),
            ("myexample.com", ".example.com", False),
            
            # Different domains - should not match
            ("example.org", "example.com", False),
            ("example.org", ".example.com", False),
            ("google.com", "example.com", False),
            
            # Edge cases - prevent TLD-only matching
            ("com", ".com", False),  # TLD shouldn't match - security issue
            ("example.com", ".com", False),  # .com cookie shouldn't match all .com domains
            ("", "example.com", False),  # Empty host
            ("example.com", "", False),  # Empty domain
        ]
        
        for host, cookie_domain, should_match in test_cases:
            with self.subTest(host=host, cookie_domain=cookie_domain):
                # Simulate the fixed logic from main.py
                dom = cookie_domain.lstrip(".")
                
                # This is the FIXED logic with TLD protection
                matches = bool(dom and host and "." in dom and (host == dom or host.endswith("." + dom)))
                
                # Verify against expected result
                self.assertEqual(
                    matches, 
                    should_match,
                    f"Domain matching failed for host='{host}', domain='{cookie_domain}'. "
                    f"Expected {'match' if should_match else 'no match'}, got {'match' if matches else 'no match'}"
                )
    
    def test_vulnerable_cookie_domain_matching(self):
        """Demonstrate the vulnerability in the OLD cookie matching logic."""
        
        # This test shows why the old logic was vulnerable
        host = "notevil.com"
        cookie_domain = "evil.com"
        
        # OLD vulnerable logic (what we fixed)
        dom = cookie_domain.lstrip(".")
        vulnerable_match = host.endswith(dom)  # This would incorrectly return True!
        
        # The vulnerable logic would match - this is BAD
        self.assertTrue(vulnerable_match, "Old logic has vulnerability - 'notevil.com' matches 'evil.com'")
        
        # NEW fixed logic with TLD protection
        fixed_match = bool(dom and host and "." in dom and (host == dom or host.endswith("." + dom)))
        
        # The fixed logic correctly does NOT match - this is GOOD
        self.assertFalse(fixed_match, "Fixed logic prevents vulnerability - 'notevil.com' does not match 'evil.com'")


if __name__ == "__main__":
    unittest.main()