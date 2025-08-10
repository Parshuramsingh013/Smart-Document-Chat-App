import re
from django import template

register = template.Library()


# @register.filter
# def regex_replace(value, args):
#     """
#     Custom filter to replace a regex pattern in a string.
#     Usage: {{ value|regex_replace:"pattern,replacement" }}
#     """
#     try:
#         pattern, replacement = args.split(',')
#         return re.sub(pattern, replacement, value)
#     except ValueError:
#         return value

@register.filter
def clean_document_name(value):
    """
    Custom filter to clean the document name by removing the 'documents/' prefix
    and the unique suffix before the '.pdf' extension.
    """
    # Remove the 'documents/' prefix
    value = value.replace('documents/', '')
    # Remove the unique suffix before the '.pdf' extension
    value = re.sub(r'_[^_]+\.pdf$', '.pdf', value)
    return value
